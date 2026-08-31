import { DEEP_LOCATIONS, deepScene, deepTargetFlag, type DeepTargetOption } from '../data/deep-exploration.ts';
import { ITEM_MAP } from '../data/items.ts';
import type { ExplorationSkillId, GameState } from '../types.ts';
import { dailyActionBlockedReason } from './daily.ts';
import { completeTimedAction, type EngineResult } from './day.ts';
import { addItem, canAddWeight, inventoryCount, inventoryWeight, removeItem } from './inventory.ts';
import { normalizeSeed, randomInt } from './rng.ts';
import { absoluteDay, addFlag, applyEffect, createLog, describeDanger, rollDanger } from './state.ts';
import { formatDuration, timeDisabledReason } from './time.ts';

export const EXPLORATION_SKILL_LABELS: Record<ExplorationSkillId, string> = {
  lockpicking: '开锁', toolUse: '工具使用', search: '观察搜寻',
};

function locationFor(state: GameState) {
  return state.expedition ? DEEP_LOCATIONS[state.expedition.locationId] : undefined;
}

export function deepTargetRefreshMode(target: { resolvedByFlag?: string; options: DeepTargetOption[] }): 'once' | 'daily' {
  if (target.resolvedByFlag) return 'once';
  const containsUniqueStory = target.options.some((option) => Object.keys(option.loot ?? {}).some((itemId) => ITEM_MAP[itemId]?.story));
  const containsEndingEvidence = target.options.some((option) => option.addFlags?.some((flag) => flag.startsWith('evidence-') || flag === 'substation-control-searched'));
  return containsUniqueStory || containsEndingEvidence ? 'once' : 'daily';
}

export function deepTargetCompletionFlag(locationId: string, target: { id: string; resolvedByFlag?: string; options: DeepTargetOption[] }, survivalDay: number): string {
  return deepTargetRefreshMode(target) === 'once'
    ? deepTargetFlag(locationId, target.id)
    : `${deepTargetFlag(locationId, target.id)}:day:${survivalDay}`;
}

export function isDeepTargetResolved(state: GameState, locationId: string, target: { id: string; resolvedByFlag?: string; options: DeepTargetOption[] }): boolean {
  if (target.resolvedByFlag && state.flags.includes(target.resolvedByFlag)) return true;
  return state.flags.includes(deepTargetCompletionFlag(locationId, target, state.survivalDay));
}

export function hardDeepLootRetention(survivalDay: number): number {
  const day = Math.max(1, survivalDay);
  if (day >= 12) return 0.2;
  if (day >= 9) return 0.35;
  if (day >= 5) return 0.5;
  return 0.65;
}

export function repeatDeepLootRetention(difficulty: GameState['difficulty'], visits: number): number {
  if (difficulty === 'easy' || visits <= 0) return 1;
  if (difficulty === 'normal') {
    if (visits >= 4) return 0.25;
    if (visits === 3) return 0.4;
    if (visits === 2) return 0.55;
    return 0.75;
  }
  if (visits >= 4) return 0.35;
  if (visits === 3) return 0.5;
  if (visits === 2) return 0.65;
  return 0.82;
}

function reserveReason(state: GameState, minutes: number): string | null {
  const location = locationFor(state);
  if (!location) return '当前不在探索地点内';
  return timeDisabledReason(state, minutes + location.returnMinutes);
}

function gainSkill(state: GameState, skill: ExplorationSkillId, amount: number): string {
  const before = state.explorationSkills[skill];
  const xp = before.xp + amount;
  const level = Math.min(5, Math.floor(xp / 3));
  state.explorationSkills[skill] = { xp, level };
  state.feedback.push({ id: `${state.runId}-skill-${skill}-${state.logs.length}-${xp}`, label: EXPLORATION_SKILL_LABELS[skill], delta: amount, reason: '探索经验' });
  return level > before.level ? `${EXPLORATION_SKILL_LABELS[skill]}提升到 ${level} 级。` : `${EXPLORATION_SKILL_LABELS[skill]}经验 +${amount}。`;
}

export function deepOptionDisabledReason(state: GameState, targetId: string, optionId: string): string | null {
  const location = locationFor(state);
  const scene = state.expedition ? deepScene(state.expedition.locationId, state.expedition.sceneId) : undefined;
  const target = scene?.targets.find((entry) => entry.id === targetId);
  const option = target?.options.find((entry) => entry.id === optionId);
  if (!location || !scene || !target || !option) return '这个处理方式当前不可用';
  if (isDeepTargetResolved(state, location.id, target)) return deepTargetRefreshMode(target) === 'once' ? '这个剧情目标已经永久处理完毕' : '这个搜刮点今天已经处理过，明天会刷新';
  for (const requirement of option.requirements ?? []) {
    if (requirement.item && inventoryCount(state.inventory, requirement.item) < (requirement.quantity ?? 1)) {
      return `缺少 ${ITEM_MAP[requirement.item]?.name ?? requirement.item}${(requirement.quantity ?? 1) > 1 ? ` ×${requirement.quantity}` : ''}`;
    }
    if (requirement.skill && state.explorationSkills[requirement.skill].level < (requirement.minSkill ?? 0)) {
      return `${EXPLORATION_SKILL_LABELS[requirement.skill]}需要 ${requirement.minSkill} 级（当前 ${state.explorationSkills[requirement.skill].level}）`;
    }
    if (requirement.minIntel !== undefined && state.intel < requirement.minIntel) return `情报需要 ${requirement.minIntel}（当前 ${state.intel}）`;
    if (requirement.flag && !state.flags.includes(requirement.flag)) {
      return requirement.flag === 'substation-route' ? '尚未发现变电站备用入口路线' : '尚未发现所需路线或线索';
    }
  }
  for (const [itemId, quantity] of Object.entries(option.consumes ?? {})) {
    if (inventoryCount(state.inventory, itemId) < quantity) return `缺少 ${ITEM_MAP[itemId]?.name ?? itemId} ×${quantity}`;
  }
  const reservedLoot = Object.entries(option.loot ?? {}).filter(([itemId]) => (
    ITEM_MAP[itemId]?.story || option.guaranteedLoot?.includes(itemId)
  ) && inventoryCount(state.inventory, itemId) === 0);
  if (reservedLoot.length) {
    const freedWeight = Object.entries(option.consumes ?? {}).reduce((sum, [itemId, quantity]) => sum + (ITEM_MAP[itemId]?.weight ?? 0) * quantity, 0);
    const reservedWeight = reservedLoot.reduce((sum, [itemId, quantity]) => sum + (ITEM_MAP[itemId]?.weight ?? 0) * quantity, 0);
    if (inventoryWeight(state.inventory, ITEM_MAP) - freedWeight + reservedWeight > state.carryCapacity + 0.0001) {
      return `需要为关键物品预留 ${reservedWeight.toFixed(2)}kg；先回避难所整理物资，这个目标不会消失`;
    }
  }
  if (state.stats.stamina <= option.stamina) return `体力不足（需要高于 ${option.stamina}）`;
  return reserveReason(state, option.minutes);
}

export function deepApproachRisk(state: GameState, locationId: string): number {
  const location = DEEP_LOCATIONS[locationId];
  if (!location) return 85;
  const hasRaincoat = inventoryCount(state.inventory, 'raincoat') > 0;
  const hasFlashlight = inventoryCount(state.inventory, 'flashlight') > 0;
  const weatherPenalty = state.weather === '酸雨'
    ? hasRaincoat ? 2 : 8
    : state.weather === '暴雨'
      ? hasRaincoat ? 2 : 6
      : state.weather === '大雾'
        ? hasFlashlight ? 1 : 4
        : 0;
  return location.approachRisk + Math.min(12, Math.max(0, state.survivalDay - 1)) + weatherPenalty;
}

export function beginDeepExplore(state: GameState, locationId: string): EngineResult {
  const location = DEEP_LOCATIONS[locationId];
  if (!location || state.phase !== 'survival') return { state, ok: false, message: '这个地点暂不支持深入探索。' };
  if (state.expedition) return { state, ok: false, message: '你已经在一次探索途中。' };
  const dailyReason = dailyActionBlockedReason(state);
  if (dailyReason) return { state, ok: false, message: dailyReason };
  if (state.stats.stamina <= 12) return { state, ok: false, message: '体力不足以承担往返路程（需要高于 12）。' };
  const reason = timeDisabledReason(state, location.travelMinutes + location.returnMinutes);
  if (reason) return { state, ok: false, message: reason };
  let next = structuredClone(state);
  next.feedback = [];
  const baseRisk = deepApproachRisk(next, locationId);
  const danger = rollDanger(next, baseRisk);
  next = danger.state;
  if (danger.severity === 'minor') next = applyEffect(next, { stats: { stamina: -5, health: -2 } }, `前往${location.name}`);
  if (danger.severity === 'major') next = applyEffect(next, { stats: { stamina: -9, health: -7 }, injury: '外伤' }, `前往${location.name}`);
  next.expedition = { locationId, sceneId: location.entrance, startedAtMinutes: state.clockMinutes, discoveredScenes: [location.entrance], gathered: [] };
  const dailyTargets = location.scenes.flatMap((scene) => scene.targets).filter((target) => deepTargetRefreshMode(target) === 'daily' && !isDeepTargetResolved(next, location.id, target)).length;
  next.logs.push(createLog(next, `进入 · ${location.name}`, `你抵达${location.name}，把回程所需的 ${formatDuration(location.returnMinutes)} 单独留了出来。${describeDanger(danger)} 这里共有 ${location.scenes.length} 个内部区域，今日仍有 ${dailyTargets} 个普通搜刮点可处理；剧情证据不会刷新。区域路线图会标出入口最短路线；选择撤离时系统自动折返，室内返路已计入固定回程窗口。`, danger.severity === 'major' ? 'bad' : 'story'));
  return completeTimedAction(next, location.travelMinutes, 'survival:deep-travel');
}

export function moveDeepExplore(state: GameState, sceneId: string): EngineResult {
  const location = locationFor(state);
  const current = state.expedition ? deepScene(state.expedition.locationId, state.expedition.sceneId) : undefined;
  const destination = location ? deepScene(location.id, sceneId) : undefined;
  if (!location || !current || !destination || !current.connections.includes(sceneId)) return { state, ok: false, message: '这里没有通往该区域的路。' };
  const reason = reserveReason(state, 10);
  if (reason) return { state, ok: false, message: reason };
  const next = structuredClone(state);
  next.feedback = [];
  next.stats.stamina = Math.max(0, next.stats.stamina - 1);
  next.feedback.push({ id: `${next.runId}-move-stamina-${next.logs.length}`, label: '体力', delta: -1, reason: '地点内移动' });
  next.expedition!.sceneId = sceneId;
  if (!next.expedition!.discoveredScenes.includes(sceneId)) {
    next.expedition!.discoveredScenes.push(sceneId);
    next.logs.push(createLog(next, `抵达 · ${destination.name}`, destination.text, 'story'));
  }
  return completeTimedAction(next, 10, 'survival:deep-move');
}

export function adjustedDeepLoot(
  state: Pick<GameState, 'difficulty' | 'seed'> & Partial<Pick<GameState, 'survivalDay' | 'visited'>>,
  loot: Record<string, number> | undefined,
  targetKey: string,
  guaranteedLoot: readonly string[] = [],
): Record<string, number> {
  const source = loot ?? {};
  if (state.difficulty === 'easy') return { ...source };

  const result: Record<string, number> = {};
  const guaranteed = new Set(guaranteedLoot);
  const regularUnits: string[] = [];
  for (const [itemId, quantity] of Object.entries(source).sort(([a], [b]) => a.localeCompare(b))) {
    if (ITEM_MAP[itemId]?.story || guaranteed.has(itemId)) result[itemId] = quantity;
    else for (let index = 0; index < quantity; index += 1) regularUnits.push(itemId);
  }
  if (!regularUnits.length) return result;

  const day = Math.max(1, state.survivalDay ?? 1);
  const locationId = targetKey.split(':')[0];
  const visits = Math.max(0, state.visited?.[locationId] ?? 0);
  const dayRetention = state.difficulty === 'hard' ? hardDeepLootRetention(day) : 1;
  const retention = dayRetention * repeatDeepLootRetention(state.difficulty, visits);
  let keepCount = Math.round(regularUnits.length * retention);
  if (regularUnits.length === 1) {
    keepCount = normalizeSeed(`${state.seed}:${day}:${visits}:${targetKey}:${state.difficulty}-loot-single`) % 100 < retention * 100 ? 1 : 0;
  }
  let seed = normalizeSeed(`${state.seed}:${day}:${visits}:${targetKey}:${state.difficulty}-loot-order`);
  const shuffled = [...regularUnits];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const roll = randomInt(seed, 0, index);
    seed = roll.state;
    [shuffled[index], shuffled[roll.value]] = [shuffled[roll.value], shuffled[index]];
  }
  for (const itemId of shuffled.slice(0, keepCount)) result[itemId] = (result[itemId] ?? 0) + 1;
  return result;
}

function collectLoot(state: GameState, option: DeepTargetOption, targetKey: string): { found: string[]; left: string[]; scarce: string[] } {
  const found: string[] = [];
  const left: string[] = [];
  const scarce: string[] = [];
  const adjusted = adjustedDeepLoot(state, option.loot, targetKey, option.guaranteedLoot);
  const guaranteed = new Set(option.guaranteedLoot ?? []);
  for (const [itemId, quantity] of Object.entries(option.loot ?? {})) {
    const remaining = quantity - (adjusted[itemId] ?? 0);
    if (remaining > 0 && !ITEM_MAP[itemId]?.story) scarce.push(`${ITEM_MAP[itemId]?.name ?? itemId} ×${remaining}`);
  }
  // Put route-opening and one-off story loot into the bag first. The capacity
  // preflight reserves their weight, so ordinary loot must never consume that
  // reservation and permanently resolve the target before the key item lands.
  const orderedLoot = Object.entries(adjusted).sort(([leftId], [rightId]) => {
    const leftReserved = ITEM_MAP[leftId]?.story || guaranteed.has(leftId) ? 1 : 0;
    const rightReserved = ITEM_MAP[rightId]?.story || guaranteed.has(rightId) ? 1 : 0;
    return rightReserved - leftReserved;
  });
  for (const [itemId, quantity] of orderedLoot) {
    const item = ITEM_MAP[itemId];
    if (!item) continue;
    if (item.story && inventoryCount(state.inventory, itemId) > 0) continue;
    let added = 0;
    for (let index = 0; index < quantity; index += 1) {
      if (!canAddWeight(state.inventory, item, 1, state.carryCapacity, ITEM_MAP)) break;
      state.inventory = addItem(state.inventory, item, 1, absoluteDay(state));
      added += 1;
    }
    if (added) {
      found.push(`${item.name} ×${added}`);
      state.feedback.push({ id: `${state.runId}-deep-loot-${state.logs.length}-${itemId}`, label: item.name, delta: added, reason: '现场所得' });
      state.expedition?.gathered.push(`${item.name} ×${added}`);
    }
    if (added < quantity) left.push(`${item.name} ×${quantity - added}`);
  }
  return { found, left, scarce };
}

export function resolveDeepTarget(state: GameState, targetId: string, optionId: string): EngineResult {
  const location = locationFor(state);
  const scene = state.expedition ? deepScene(state.expedition.locationId, state.expedition.sceneId) : undefined;
  const target = scene?.targets.find((entry) => entry.id === targetId);
  const option: DeepTargetOption | undefined = target?.options.find((entry) => entry.id === optionId);
  if (!location || !scene || !target || !option) return { state, ok: false, message: '目标或处理方式不存在。' };
  const disabled = deepOptionDisabledReason(state, targetId, optionId);
  if (disabled) return { state, ok: false, message: disabled };
  let next = structuredClone(state);
  next.feedback = [];
  for (const [itemId, quantity] of Object.entries(option.consumes ?? {})) next.inventory = removeItem(next.inventory, itemId, quantity) ?? next.inventory;
  next = applyEffect(next, {
    ...option.effects,
    stats: {
      ...(option.effects?.stats ?? {}),
      stamina: (option.effects?.stats?.stamina ?? 0) - option.stamina,
    },
  }, target.name);
  let dangerText = '';
  let tone: 'story' | 'bad' = 'story';
  if (option.danger) {
    const danger = rollDanger(next, option.danger);
    next = danger.state;
    dangerText = ` ${describeDanger(danger)}`;
    if (danger.severity === 'minor') next = applyEffect(next, { stats: { health: -3, morale: -1 } }, '探索意外');
    if (danger.severity === 'major') {
      next = applyEffect(next, { stats: { health: -9, morale: -3 }, injury: '外伤' }, '探索意外');
      tone = 'bad';
    }
  }
  const loot = collectLoot(next, option, `${location.id}:${target.id}:${option.id}`);
  const skillText = Object.entries(option.skillXp ?? {}).map(([skill, amount]) => gainSkill(next, skill as ExplorationSkillId, amount ?? 0)).join('');
  for (const flag of option.addFlags ?? []) addFlag(next, flag);
  addFlag(next, deepTargetCompletionFlag(location.id, target, next.survivalDay));
  const lootText = loot.found.length
    ? `带上：${loot.found.join('、')}。`
    : loot.scarce.length
      ? '能用的货格已经被先来者取空。'
      : '背包已满，没能带走物资。';
  const leftText = loot.left.length ? ` 负重不足，留下：${loot.left.join('、')}。` : '';
  const visitCount = next.visited[location.id] ?? 0;
  const scarceText = loot.scarce.length
    ? next.difficulty === 'hard'
      ? ` 困难模式第 ${next.survivalDay} 天，加上此前 ${visitCount} 次搜刮，这批刷新物资已有部分被先来者取空：${loot.scarce.join('、')}。`
      : ` 你已多次搜索这个地点，普通货格只补回了一部分：${loot.scarce.join('、')}。`
    : '';
  next.logs.push(createLog(next, `${scene.name} · ${target.name}`, `${option.result}${dangerText} ${lootText}${leftText}${scarceText} ${skillText}`, tone));
  return completeTimedAction(next, option.minutes, 'survival:deep-action');
}

export function leaveDeepExplore(state: GameState): EngineResult {
  const location = locationFor(state);
  if (!location || !state.expedition) return { state, ok: false, message: '当前不在探索地点内。' };
  const reason = timeDisabledReason(state, location.returnMinutes);
  if (reason) return { state, ok: false, message: reason };
  let next = structuredClone(state);
  next.feedback = [];
  const gathered = [...next.expedition!.gathered];
  const discovered = next.expedition!.discoveredScenes.length;
  const gatheredFeedback = gathered.map((entry, index) => {
    const quantityMatch = entry.match(/ ×(\d+)$/);
    return {
      id: `${next.runId}-expedition-summary-${next.logs.length}-${index}`,
      label: quantityMatch ? entry.slice(0, quantityMatch.index) : entry,
      delta: quantityMatch ? Number(quantityMatch[1]) : 1,
      reason: '本次外出带回',
    };
  });
  next.expedition = undefined;
  next.visited[location.id] = (next.visited[location.id] ?? 0) + 1;
  next = applyEffect(next, { stats: { stamina: -3 } }, '返程');
  next.feedback.push(...gatheredFeedback);
  next.logs.push(createLog(next, `返回 · ${location.name}`, `你沿原路回到避难所。本次进入 ${discovered}/${location.scenes.length} 个区域；${gathered.length ? `带回 ${gathered.join('、')}` : '没有带回新物资'}。尚未处理的目标今天仍会保留；普通搜刮点会在下一封锁日刷新，剧情目标永久记录。`, 'good'));
  return completeTimedAction(next, location.returnMinutes, 'survival:explore');
}

export function deepStartDisabledReason(state: GameState, locationId: string): string | null {
  const location = DEEP_LOCATIONS[locationId];
  if (!location) return '这个地点暂不支持深入探索';
  if (state.stats.stamina <= 12) return '体力不足以承担往返路程（需要高于 12）';
  return timeDisabledReason(state, location.travelMinutes + location.returnMinutes);
}
