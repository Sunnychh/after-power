import { EVENTS } from '../data/events.ts';
import { DIFFICULTY_MAP } from '../data/difficulties.ts';
import { createFurnitureState } from '../data/furniture.ts';
import { ITEM_MAP } from '../data/items.ts';
import { NPCS, WEATHER_SEQUENCE } from '../data/world.ts';
import type {
  AbilityId,
  DifficultyId,
  EventEffect,
  FeedbackItem,
  GameEvent,
  GameState,
  LogEntry,
  MetaState,
  Requirement,
  StatKey,
  Weather,
} from '../types.ts';
import { addItem, inventoryCount, removeItem } from './inventory.ts';
import { normalizeSeed, randomInt, seededPick } from './rng.ts';
import { PREP_DAY_START } from './time.ts';

export const GAME_SAVE_KEY = 'after-power-game-v3';
export const PREVIOUS_GAME_SAVE_KEY = 'after-power-game-v2';
export const LEGACY_GAME_SAVE_KEY = 'after-power-game-v1';
export const META_SAVE_KEY = 'after-power-meta-v1';
export const SETTINGS_KEY = 'after-power-settings-v1';

export const DEFAULT_META: MetaState = { version: 1, memory: 0, runs: 0, unlocked: [], endings: [], awardedRuns: [] };

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

export function absoluteDay(state: GameState): number {
  return state.phase === 'prep' ? state.prepDay : 7 + state.survivalDay;
}

export function dayLabel(state: GameState): string {
  if (state.phase === 'prep') return `灾前第 ${state.prepDay} 天`;
  if (state.phase === 'ended') return state.outcome?.title ?? '本轮结束';
  return `封锁第 ${state.survivalDay} 天`;
}

export function createLog(state: GameState, title: string, body: string, tone: LogEntry['tone'] = 'story'): LogEntry {
  return {
    id: `${state.runId}-${state.logs.length + 1}`,
    dayLabel: dayLabel(state),
    title,
    body,
    tone,
  };
}

export function createInitialState(
  seed: number | string,
  unlocked: AbilityId[] = [],
  runOrdinal = 0,
  difficulty: DifficultyId = 'normal',
): GameState {
  const normalized = normalizeSeed(seed);
  const difficultyConfig = DIFFICULTY_MAP[difficulty];
  const easy = difficulty === 'easy';
  const hard = difficulty === 'hard';
  const state: GameState = {
    version: 3,
    runId: `run-${normalized.toString(16)}-${runOrdinal}`,
    seed: normalized,
    rngState: normalized,
    difficulty,
    phase: 'prep',
    prepDay: 1,
    survivalDay: 0,
    clockMinutes: PREP_DAY_START,
    money: difficultyConfig.startMoney,
    stats: {
      satiety: easy ? 96 : hard ? 84 : 90,
      hydration: easy ? 96 : hard ? 84 : 90,
      health: easy ? 96 : hard ? 84 : 90,
      morale: unlocked.includes('steady') ? (easy ? 96 : hard ? 80 : 87) : (easy ? 84 : hard ? 66 : 75),
      stamina: easy ? 92 : hard ? 72 : 82,
    },
    shelter: {
      integrity: 45,
      water: 0,
      power: 0,
      fuel: 0,
      reinforcement: 0,
      storage: 70,
      generator: 0,
      ...difficultyConfig.startingShelter,
    },
    furniture: createFurnitureState(),
    inventory: {},
    carryCapacity: difficultyConfig.carryCapacity + (unlocked.includes('packer') ? 8 : 0),
    weather: '晴冷',
    intel: 0,
    broadcasts: 0,
    relationships: Object.fromEntries(NPCS.map((npc) => [npc.id, 0])),
    injuries: [],
    flags: unlocked.map((ability) => `ability:${ability}`),
    seenEvents: [],
    visited: {},
    logs: [],
    feedback: [],
    tutorialStep: 0,
    dailyPoints: 0,
  };
  for (const [itemId, quantity] of Object.entries(difficultyConfig.startingInventory)) {
    const item = ITEM_MAP[itemId];
    if (item) state.inventory = addItem(state.inventory, item, quantity, 1);
  }
  state.currentEventId = selectEvent(state)?.id;
  state.logs = [createLog(
    state,
    '倒计时开始',
    `你收到一条来自旧同事的加密消息：七天后，这座城市会以传染病为由全面封锁。消息最后只有一句——别等官方通知。本轮采用${difficultyConfig.name}难度。`,
    'system',
  )];
  return state;
}

export function hasFlag(state: GameState, flag: string): boolean {
  return state.flags.includes(flag);
}

export function addFlag(state: GameState, flag: string): void {
  if (!state.flags.includes(flag)) state.flags.push(flag);
}

export function requirementMet(state: GameState, requirement: Requirement): boolean {
  if (requirement.item && inventoryCount(state.inventory, requirement.item) < (requirement.quantity ?? 1)) return false;
  if (requirement.flag && !hasFlag(state, requirement.flag)) return false;
  if (requirement.minIntel !== undefined && state.intel < requirement.minIntel) return false;
  if (requirement.minStat) {
    for (const [key, value] of Object.entries(requirement.minStat)) {
      if (state.stats[key as StatKey] < (value ?? 0)) return false;
    }
  }
  return true;
}

export function unmetRequirementLabel(state: GameState, requirements: Requirement[] = []): string | null {
  for (const requirement of requirements) {
    if (requirement.item && inventoryCount(state.inventory, requirement.item) < (requirement.quantity ?? 1)) {
      return `缺少 ${ITEM_MAP[requirement.item]?.name ?? requirement.item} ×${requirement.quantity ?? 1}`;
    }
    if (requirement.flag && !hasFlag(state, requirement.flag)) return '尚未掌握必要线索';
    if (requirement.minIntel !== undefined && state.intel < requirement.minIntel) return `需要情报 ${requirement.minIntel}`;
    if (requirement.minStat) {
      const names: Record<StatKey, string> = { satiety: '饱腹', hydration: '水分', health: '健康', morale: '精神', stamina: '体力' };
      for (const [key, value] of Object.entries(requirement.minStat)) {
        if (state.stats[key as StatKey] < (value ?? 0)) return `${names[key as StatKey]}需要达到 ${value}`;
      }
    }
  }
  return null;
}

function eventEligible(state: GameState, event: GameEvent): boolean {
  const phase = state.phase === 'prep' ? 'prep' : 'survival';
  if (event.phase !== 'both' && event.phase !== phase) return false;
  if (state.seenEvents.includes(event.id)) return false;
  const day = phase === 'prep' ? state.prepDay : state.survivalDay;
  if (event.id === 'final-broadcast-window' && day !== DIFFICULTY_MAP[state.difficulty].truthDecisionDay) return false;
  if (event.minDay !== undefined && day < event.minDay) return false;
  if (event.maxDay !== undefined && day > event.maxDay) return false;
  if (event.weather && !event.weather.includes(state.weather)) return false;
  if (event.requiresFlags?.some((flag) => !hasFlag(state, flag))) return false;
  if (event.excludesFlags?.some((flag) => hasFlag(state, flag))) return false;
  return true;
}

export function selectEvent(state: GameState): GameEvent | undefined {
  const candidates = EVENTS.filter((event) => eventEligible(state, event));
  if (!candidates.length) return undefined;
  const day = state.phase === 'prep' ? state.prepDay : state.survivalDay;
  const truthDecisionDay = state.phase === 'survival' ? DIFFICULTY_MAP[state.difficulty].truthDecisionDay : -1;
  const routeDecision = day === truthDecisionDay ? candidates.find((event) => event.id === 'final-broadcast-window') : undefined;
  if (routeDecision) return routeDecision;
  const fixed = candidates.filter((event) => event.minDay === day && event.maxDay === day);
  const chain = candidates.filter((event) => event.chain && event.chain.step > 1);
  const pool = (fixed.length ? fixed : chain.length ? chain : candidates).sort((a, b) => a.id.localeCompare(b.id));
  const pick = seededPick(state.rngState, pool);
  state.rngState = pick.state;
  return pick.value;
}

const FEEDBACK_NAMES: Record<string, string> = {
  satiety: '饱腹', hydration: '水分', health: '健康', morale: '精神', stamina: '体力',
  integrity: '完整度', water: '储水', power: '电力', fuel: '燃料', reinforcement: '加固',
  storage: '仓储', generator: '供电等级', money: '金钱', intel: '情报',
};

function pushFeedback(state: GameState, key: string, delta: number, reason: string): void {
  if (!delta) return;
  const item: FeedbackItem = {
    id: `${state.runId}-change-${state.logs.length}-${state.feedback.length}`,
    label: FEEDBACK_NAMES[key] ?? key,
    delta,
    reason,
  };
  state.feedback.push(item);
}

export function applyEffect(state: GameState, effect: EventEffect = {}, reason: string): GameState {
  const next: GameState = structuredClone(state);
  next.feedback = [];
  if (effect.stats) {
    for (const [key, delta] of Object.entries(effect.stats)) {
      const statKey = key as StatKey;
      const before = next.stats[statKey];
      next.stats[statKey] = clamp(before + (delta ?? 0));
      pushFeedback(next, statKey, next.stats[statKey] - before, reason);
    }
  }
  if (effect.shelter) {
    for (const [rawKey, delta] of Object.entries(effect.shelter)) {
      const key = rawKey as keyof GameState['shelter'];
      const before = next.shelter[key];
      const max = key === 'integrity' ? 100 : key === 'storage' ? 120 : 40;
      next.shelter[key] = clamp(before + (delta ?? 0), 0, max);
      pushFeedback(next, key, next.shelter[key] - before, reason);
    }
  }
  if (effect.money) {
    const before = next.money;
    next.money = Math.max(0, next.money + effect.money);
    pushFeedback(next, 'money', next.money - before, reason);
  }
  if (effect.intel) {
    next.intel = Math.max(0, next.intel + effect.intel);
    pushFeedback(next, 'intel', effect.intel, reason);
  }
  if (effect.inventory) {
    for (const [itemId, delta] of Object.entries(effect.inventory)) {
      const item = ITEM_MAP[itemId];
      if (!item || !delta) continue;
      if (delta > 0) next.inventory = addItem(next.inventory, item, delta, absoluteDay(next));
      else next.inventory = removeItem(next.inventory, itemId, -delta) ?? next.inventory;
      pushFeedback(next, item.name, delta, reason);
    }
  }
  if (effect.relationships) {
    for (const [npcId, delta] of Object.entries(effect.relationships)) {
      next.relationships[npcId] = clamp((next.relationships[npcId] ?? 0) + delta, -30, 60);
      const npc = NPCS.find((person) => person.id === npcId);
      pushFeedback(next, `${npc?.name ?? npcId}信任`, delta, reason);
    }
  }
  for (const flag of effect.addFlags ?? []) addFlag(next, flag);
  if (effect.removeFlags?.length) next.flags = next.flags.filter((flag) => !effect.removeFlags?.includes(flag));
  if (effect.injury && !next.injuries.includes(effect.injury)) next.injuries.push(effect.injury);
  return next;
}

export function rollDanger(state: GameState, baseRisk: number): { state: GameState; roll: number; risk: number; severity: 'safe' | 'minor' | 'major' } {
  const next = structuredClone(state);
  const statusPenalty = (next.stats.health < 40 ? 10 : 0) + (next.stats.morale < 35 ? 8 : 0) + (next.stats.stamina < 30 ? 8 : 0);
  const gearBonus = inventoryCount(next.inventory, 'respirator') > 0 ? 8 : inventoryCount(next.inventory, 'masks') > 0 ? 4 : 0;
  const mapBonus = hasFlag(next, 'ability:map') ? 8 : 0;
  const difficultyModifier = DIFFICULTY_MAP[next.difficulty].riskModifier;
  const risk = clamp(baseRisk + difficultyModifier + statusPenalty - gearBonus - mapBonus - Math.min(12, next.intel * 3), 5, 85);
  const rolled = randomInt(next.rngState, 1, 100);
  next.rngState = rolled.state;
  const severity = rolled.value > risk ? 'safe' : rolled.value > risk / 2 ? 'minor' : 'major';
  return { state: next, roll: rolled.value, risk, severity };
}

export function weatherForDay(state: GameState, day: number): Weather {
  const pick = seededPick(state.rngState, WEATHER_SEQUENCE);
  state.rngState = pick.state;
  if (day <= 2 && ['暴雨', '酸雨', '寒潮'].includes(pick.value)) return '晴冷';
  return pick.value;
}
