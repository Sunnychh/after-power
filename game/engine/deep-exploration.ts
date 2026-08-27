import { DEEP_LOCATIONS, deepScene, deepTargetFlag, type DeepTargetOption } from '../data/deep-exploration.ts';
import { ITEM_MAP } from '../data/items.ts';
import type { ExplorationSkillId, GameState } from '../types.ts';
import { dailyActionBlockedReason } from './daily.ts';
import { completeTimedAction, type EngineResult } from './day.ts';
import { addItem, canAddWeight, inventoryCount, removeItem } from './inventory.ts';
import { absoluteDay, addFlag, applyEffect, createLog, describeDanger, rollDanger } from './state.ts';
import { formatDuration, timeDisabledReason } from './time.ts';

export const EXPLORATION_SKILL_LABELS: Record<ExplorationSkillId, string> = {
  lockpicking: '开锁', toolUse: '工具使用', search: '观察搜寻',
};

function locationFor(state: GameState) {
  return state.expedition ? DEEP_LOCATIONS[state.expedition.locationId] : undefined;
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
  if (state.flags.includes(deepTargetFlag(location.id, target.id))) return '这里已经处理完毕';
  for (const requirement of option.requirements ?? []) {
    if (requirement.item && inventoryCount(state.inventory, requirement.item) < (requirement.quantity ?? 1)) {
      return `缺少 ${ITEM_MAP[requirement.item]?.name ?? requirement.item}${(requirement.quantity ?? 1) > 1 ? ` ×${requirement.quantity}` : ''}`;
    }
    if (requirement.skill && state.explorationSkills[requirement.skill].level < (requirement.minSkill ?? 0)) {
      return `${EXPLORATION_SKILL_LABELS[requirement.skill]}需要 ${requirement.minSkill} 级（当前 ${state.explorationSkills[requirement.skill].level}）`;
    }
    if (requirement.minIntel !== undefined && state.intel < requirement.minIntel) return `情报需要 ${requirement.minIntel}（当前 ${state.intel}）`;
  }
  for (const [itemId, quantity] of Object.entries(option.consumes ?? {})) {
    if (inventoryCount(state.inventory, itemId) < quantity) return `缺少 ${ITEM_MAP[itemId]?.name ?? itemId} ×${quantity}`;
  }
  if (state.stats.stamina <= option.stamina) return `体力不足（需要高于 ${option.stamina}）`;
  return reserveReason(state, option.minutes);
}

export function beginDeepExplore(state: GameState, locationId: string): EngineResult {
  const location = DEEP_LOCATIONS[locationId];
  if (!location || state.phase !== 'survival') return { state, ok: false, message: '这个地点暂不支持深入探索。' };
  if (state.expedition) return { state, ok: false, message: '你已经在一次探索途中。' };
  const dailyReason = dailyActionBlockedReason(state);
  if (dailyReason) return { state, ok: false, message: dailyReason };
  const reason = timeDisabledReason(state, location.travelMinutes + location.returnMinutes);
  if (reason) return { state, ok: false, message: reason };
  let next = structuredClone(state);
  next.feedback = [];
  const weatherPenalty = next.weather === '酸雨' ? 8 : next.weather === '暴雨' ? 6 : next.weather === '大雾' ? 4 : 0;
  const baseRisk = 14 + Math.min(12, Math.max(0, next.survivalDay - 1)) + weatherPenalty;
  const danger = rollDanger(next, baseRisk);
  next = danger.state;
  if (danger.severity === 'minor') next = applyEffect(next, { stats: { stamina: -5, health: -2 } }, '前往超市');
  if (danger.severity === 'major') next = applyEffect(next, { stats: { stamina: -9, health: -7 }, injury: '外伤' }, '前往超市');
  next.expedition = { locationId, sceneId: location.entrance, startedAtMinutes: state.clockMinutes, discoveredScenes: [location.entrance], gathered: [] };
  next.logs.push(createLog(next, `进入 · ${location.name}`, `你沿背街抵达超市，把回程所需的 ${formatDuration(location.returnMinutes)} 单独留了出来。${describeDanger(danger)} 店内可以逐区移动；只要返回入口并撤离，就不会因为缺少某件工具卡在里面。`, danger.severity === 'major' ? 'bad' : 'story'));
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
  next.feedback.push({ id: `${next.runId}-move-stamina-${next.logs.length}`, label: '体力', delta: -1, reason: '在店内移动' });
  next.expedition!.sceneId = sceneId;
  if (!next.expedition!.discoveredScenes.includes(sceneId)) {
    next.expedition!.discoveredScenes.push(sceneId);
    next.logs.push(createLog(next, `抵达 · ${destination.name}`, destination.text, 'story'));
  }
  return completeTimedAction(next, 10, 'survival:deep-move');
}

function collectLoot(state: GameState, loot: Record<string, number> | undefined): { found: string[]; left: string[] } {
  const found: string[] = [];
  const left: string[] = [];
  for (const [itemId, quantity] of Object.entries(loot ?? {})) {
    const item = ITEM_MAP[itemId];
    if (!item) continue;
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
  return { found, left };
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
  next = applyEffect(next, { stats: { stamina: -option.stamina } }, target.name);
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
  const loot = collectLoot(next, option.loot);
  const skillText = Object.entries(option.skillXp ?? {}).map(([skill, amount]) => gainSkill(next, skill as ExplorationSkillId, amount ?? 0)).join('');
  for (const flag of option.addFlags ?? []) addFlag(next, flag);
  addFlag(next, deepTargetFlag(location.id, target.id));
  const lootText = loot.found.length ? `带上：${loot.found.join('、')}。` : '背包已满，没能带走物资。';
  const leftText = loot.left.length ? ` 负重不足，留下：${loot.left.join('、')}。` : '';
  next.logs.push(createLog(next, `${scene.name} · ${target.name}`, `${option.result}${dangerText} ${lootText}${leftText} ${skillText}`, tone));
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
  next.expedition = undefined;
  next.visited[location.id] = (next.visited[location.id] ?? 0) + 1;
  next = applyEffect(next, { stats: { stamina: -3 } }, '返程');
  next.logs.push(createLog(next, `返回 · ${location.name}`, `你沿原路回到避难所。本次进入 ${discovered}/${location.scenes.length} 个区域；${gathered.length ? `带回 ${gathered.join('、')}` : '没有带回新物资'}。尚未处理的目标会保留到下次。`, 'good'));
  return completeTimedAction(next, location.returnMinutes, 'survival:explore');
}

export function deepStartDisabledReason(state: GameState, locationId: string): string | null {
  const location = DEEP_LOCATIONS[locationId];
  if (!location) return '这个地点暂不支持深入探索';
  return timeDisabledReason(state, location.travelMinutes + location.returnMinutes);
}
