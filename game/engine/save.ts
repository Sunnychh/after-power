import { createFurnitureState } from '../data/furniture.ts';
import { DEEP_LOCATIONS } from '../data/deep-exploration.ts';
import { ITEM_MAP } from '../data/items.ts';
import { EVENT_MAP } from '../data/events.ts';
import { DAILY_COMMISSION_MAP } from '../data/commissions.ts';
import { ACHIEVEMENT_MAP } from '../data/achievements.ts';
import { NPCS } from '../data/world.ts';
import type { AchievementId, GameState, MetaState, Outcome, SettingsState, StorageLike } from '../types.ts';
import { expireItems } from './inventory.ts';
import { ensureAssignedDailyWish } from './daily.ts';
import { foodFamily } from './nutrition.ts';
import { createAssignedDailyPlan } from './wish-plan.ts';
import {
  absoluteDay,
  DEFAULT_META,
  GAME_SAVE_KEY,
  LEGACY_GAME_SAVE_KEY,
  META_SAVE_KEY,
  PREVIOUS_GAME_SAVE_KEY,
  SETTINGS_KEY,
  VERSION2_GAME_SAVE_KEY,
  isEventEligible,
} from './state.ts';
import { PREP_DAY_START, SURVIVAL_DAY_START } from './time.ts';

export const DEFAULT_SETTINGS: SettingsState = {
  shortcuts: true,
  reducedMotion: false,
  highContrast: false,
  fontScale: 'normal',
  tutorial: true,
};

function safeParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function saveGame(storage: StorageLike, state: GameState): void {
  storage.setItem(GAME_SAVE_KEY, JSON.stringify(state));
  storage.removeItem(PREVIOUS_GAME_SAVE_KEY);
  storage.removeItem(VERSION2_GAME_SAVE_KEY);
  storage.removeItem(LEGACY_GAME_SAVE_KEY);
}

type LegacyOutcome = Omit<Outcome, 'variantId' | 'keyChoices'> & {
  variantId?: string;
  keyChoices?: string[];
};

type Version3GameState = Omit<GameState, 'version' | 'shelter' | 'foodFatigue' | 'foodFamilyFatigue' | 'eatenFoodIds' | 'lastContactDay'> & {
  version: 3;
  shelter: Omit<GameState['shelter'], 'rawWater'> & { rawWater?: number; storage?: number };
  foodFatigue?: Record<string, number>;
  foodFamilyFatigue?: Record<string, number>;
  eatenFoodIds?: string[];
  lastContactDay?: number;
};

type Version2GameState = Omit<Version3GameState, 'version' | 'dailyPoints' | 'dailyPlan' | 'dailySettlement' | 'outcome'> & {
  version: 2;
  outcome?: LegacyOutcome;
};

type LegacyGameState = Omit<Version2GameState, 'version' | 'difficulty' | 'clockMinutes' | 'furniture'> & {
  version: 1;
  actionPoints?: number;
  maxActionPoints?: number;
};

function normalizeOutcome(outcome: LegacyOutcome | undefined): Outcome | undefined {
  if (!outcome) return undefined;
  return {
    ...outcome,
    variantId: outcome.variantId ?? `${outcome.id}-legacy`,
    keyChoices: Array.isArray(outcome.keyChoices) ? outcome.keyChoices : ['旧版结局记录'],
  };
}

function hasValidCore(state: Partial<GameState> | null): state is GameState {
  return Boolean(
    state
    && state.version === 4
    && state.runId
    && ['easy', 'normal', 'hard'].includes(state.difficulty ?? '')
    && ['prep', 'survival', 'ended'].includes(state.phase ?? '')
    && Number.isFinite(state.clockMinutes)
    && Number.isFinite(state.dailyPoints)
    && state.stats
    && state.shelter
    && state.furniture
    && state.inventory
    && Array.isArray(state.flags)
    && Array.isArray(state.logs)
    && (state.phase !== 'ended' || Boolean(state.outcome)),
  );
}

function inferFoodFamilyFatigue(foodFatigue: Record<string, number>): Record<string, number> {
  const inferred: Record<string, number> = {};
  for (const [itemId, fatigue] of Object.entries(foodFatigue)) {
    const item = ITEM_MAP[itemId];
    if (!item) continue;
    const family = foodFamily(item);
    inferred[family] = Math.min(100, (inferred[family] ?? 0) + Math.round(fatigue * 0.55));
  }
  return inferred;
}

function removeStaleBatches(state: GameState): GameState {
  const next = structuredClone(state);
  if (!Array.isArray(next.feedback)) next.feedback = [];
  if (!Array.isArray(next.seenEvents)) next.seenEvents = [];
  next.seenEvents = [...new Set(next.seenEvents.filter((eventId) => typeof eventId === 'string' && Boolean(EVENT_MAP[eventId])))];
  if (!Array.isArray(next.injuries)) next.injuries = [];
  next.injuries = [...new Set(next.injuries.filter((injury) => typeof injury === 'string'))];
  if (!next.relationships || typeof next.relationships !== 'object' || Array.isArray(next.relationships)) next.relationships = {};
  next.relationships = Object.fromEntries(NPCS.map((npc) => [npc.id, Math.min(60, Math.max(-30, Number.isFinite(next.relationships[npc.id]) ? next.relationships[npc.id] : 0))]));
  if (!next.visited || typeof next.visited !== 'object' || Array.isArray(next.visited)) next.visited = {};
  if (!next.storePurchases || typeof next.storePurchases !== 'object' || Array.isArray(next.storePurchases)) next.storePurchases = {};
  if (!Number.isFinite(next.shelter.rawWater)) next.shelter.rawWater = 0;
  next.shelter.rawWater = Math.min(40, Math.max(0, next.shelter.rawWater));
  if (typeof next.autoRations !== 'boolean') next.autoRations = next.difficulty === 'easy';
  if (!['balanced', 'cold', 'light', 'off'].includes(next.powerPolicy)) next.powerPolicy = 'balanced';
  if (!next.powerTrap || !Number.isFinite(next.powerTrap.level)) next.powerTrap = { level: 0, armed: false };
  next.powerTrap = { level: Math.min(3, Math.max(0, next.powerTrap.level)), armed: Boolean(next.powerTrap.armed && next.powerTrap.level > 0) };
  next.shelter.generator = Math.min(3, Math.max(0, Number.isFinite(next.shelter.generator) ? next.shelter.generator : 0));
  if (!Number.isFinite(next.cookingAttempts)) next.cookingAttempts = 0;
  if (!Number.isFinite(next.cookingSkill)) next.cookingSkill = Math.min(5, Math.floor(next.cookingAttempts / 3));
  if (!Array.isArray(next.discoveredRecipes)) next.discoveredRecipes = [];
  next.discoveredRecipes = [...new Set(next.discoveredRecipes.filter((recipeId) => typeof recipeId === 'string'))];
  if (!Number.isFinite(next.foodBoredom)) next.foodBoredom = 0;
  next.foodBoredom = Math.min(100, Math.max(0, next.foodBoredom));
  if (!next.foodFatigue || typeof next.foodFatigue !== 'object' || Array.isArray(next.foodFatigue)) next.foodFatigue = {};
  next.foodFatigue = Object.fromEntries(Object.entries(next.foodFatigue)
    .filter(([itemId, value]) => Boolean(ITEM_MAP[itemId]?.tags?.includes('food')) && Number.isFinite(value))
    .map(([itemId, value]) => [itemId, Math.min(100, Math.max(0, Number(value)))]));
  if (!Array.isArray(next.recentMeals)) next.recentMeals = [];
  next.recentMeals = next.recentMeals.filter((itemId) => typeof itemId === 'string' && Boolean(ITEM_MAP[itemId]?.tags?.includes('food'))).slice(-10);
  const inferredEaten = [...new Set([...Object.keys(next.foodFatigue), ...next.recentMeals])];
  if (!Array.isArray(next.eatenFoodIds)) next.eatenFoodIds = inferredEaten;
  next.eatenFoodIds = [...new Set(next.eatenFoodIds
    .filter((itemId) => typeof itemId === 'string' && Boolean(ITEM_MAP[itemId]?.tags?.includes('food')))
    .concat(inferredEaten))];
  if (next.foodFamilyFatigue && typeof next.foodFamilyFatigue === 'object' && !Array.isArray(next.foodFamilyFatigue)) {
    next.foodFamilyFatigue = Object.fromEntries(Object.entries(next.foodFamilyFatigue)
      .filter(([family, value]) => Boolean(family) && Number.isFinite(value))
      .map(([family, value]) => [family, Math.min(100, Math.max(0, Number(value)))]));
  } else next.foodFamilyFatigue = inferFoodFamilyFatigue(next.foodFatigue);
  if (!Number.isFinite(next.lastContactDay)) {
    if (next.broadcasts > 0) next.lastContactDay = absoluteDay(next);
    else delete next.lastContactDay;
  }
  if (!next.explorationSkills || typeof next.explorationSkills !== 'object') {
    next.explorationSkills = { lockpicking: { level: 0, xp: 0 }, toolUse: { level: 0, xp: 0 }, search: { level: 0, xp: 0 } };
  }
  for (const skill of ['lockpicking', 'toolUse', 'search'] as const) {
    const progress = next.explorationSkills[skill];
    if (!progress || !Number.isFinite(progress.xp)) next.explorationSkills[skill] = { level: 0, xp: 0 };
    else next.explorationSkills[skill] = { xp: Math.max(0, progress.xp), level: Math.min(5, Math.floor(Math.max(0, progress.xp) / 3)) };
  }
  if (next.expedition) {
    const deepLocation = DEEP_LOCATIONS[next.expedition.locationId];
    const sceneIds = new Set(deepLocation?.scenes.map((scene) => scene.id) ?? []);
    if (
      !deepLocation
      || !sceneIds.has(next.expedition.sceneId)
      || !Array.isArray(next.expedition.discoveredScenes)
      || next.expedition.discoveredScenes.some((sceneId) => !sceneIds.has(sceneId))
      || !Array.isArray(next.expedition.gathered)
      || next.phase !== 'survival'
    ) next.expedition = undefined;
  }
  if (!Number.isFinite(next.isolationNights)) next.isolationNights = 0;
  if (next.debt && (!Number.isFinite(next.debt.balance) || next.debt.balance <= 0)) next.debt = undefined;
  if (next.shoppingTrip && (
    !['market', 'pharmacy', 'hardware', 'fuel'].includes(next.shoppingTrip.store)
    || next.shoppingTrip.prepDay !== next.prepDay
    || !Number.isFinite(next.shoppingTrip.carriedWeight)
    || !Number.isFinite(next.shoppingTrip.capacity)
  )) next.shoppingTrip = undefined;
  next.inventory = expireItems(next.inventory, absoluteDay(next)).inventory;
  if (next.currentEventId) {
    const currentEvent = EVENT_MAP[next.currentEventId];
    if (!currentEvent || !isEventEligible(next, currentEvent)) next.currentEventId = undefined;
  }
  const seenDailySettlements = new Set<string>();
  const seenLogIds = new Set<string>();
  let restoredLogSequence = 1;
  next.logs = next.logs
    .filter((log) => {
      if (log.title !== '每日愿望结算') return true;
      if (seenDailySettlements.has(log.dayLabel)) return false;
      seenDailySettlements.add(log.dayLabel);
      return true;
    })
    .map((log, index) => {
      if (typeof log.id === 'string' && log.id && !seenLogIds.has(log.id)) {
        seenLogIds.add(log.id);
        return log;
      }
      let id = `${next.runId}-restored-log-${restoredLogSequence}`;
      while (seenLogIds.has(id)) {
        restoredLogSequence += 1;
        id = `${next.runId}-restored-log-${restoredLogSequence}`;
      }
      restoredLogSequence += 1;
      seenLogIds.add(id);
      return { ...log, id: id || `${next.runId}-restored-log-${index + 1}` };
    });
  if (next.flags.some((flag) => flag.startsWith('deep:north-substation:battery-bank:day:'))) {
    next.flags.push('substation-battery-bank-drained');
  }
  next.flags = [...new Set(next.flags)];
  next.feedback = next.feedback.filter((item) => item.label !== '愿望点');
  if (next.dailySettlement && (next.dailySettlement.basePoints > 0 || next.dailySettlement.deadlinePoints > 0)) {
    const obsoletePoints = next.dailySettlement.basePoints + next.dailySettlement.deadlinePoints;
    next.dailyPoints = Math.max(0, next.dailyPoints - obsoletePoints);
    next.dailySettlement.basePoints = 0;
    next.dailySettlement.deadlinePoints = 0;
    next.dailySettlement.deadlineId = 'open';
    next.dailySettlement.deadlineAchieved = next.dailySettlement.wishAchieved;
    next.dailySettlement.earnedPoints = next.dailySettlement.wishAchieved ? next.dailySettlement.wishPoints : 0;
  }
  if (next.outcome) next.phase = 'ended';
  if (next.phase === 'ended') {
    next.currentEventId = undefined;
    next.dailyPlan = undefined;
    next.dailySettlement = undefined;
    next.shoppingTrip = undefined;
    next.expedition = undefined;
    next.feedback = [];
    next.flags = next.flags.filter((flag) => {
      if (flag === 'evacuation-choice-pending') return false;
      if (next.outcome?.id === 'death' && flag === 'survived-goal-night') return false;
      if (flag.startsWith('ending:')) return flag === `ending:${next.outcome?.id}`;
      return true;
    });
  } else {
    next.flags = next.flags.filter((flag) => !flag.startsWith('ending:'));
    if (next.dailySettlement) next.dailyPlan = undefined;
    if (next.phase !== 'prep') next.shoppingTrip = undefined;
    if (next.phase !== 'survival') next.expedition = undefined;
  }
  if (next.dailyPlan && !Array.isArray(next.dailyPlan.commissions)) {
    next.dailyPlan.commissions = createAssignedDailyPlan(next, next.dailyPlan.wishId).commissions;
  } else if (next.dailyPlan?.commissions) {
    const seen = new Set<string>();
    next.dailyPlan.commissions = next.dailyPlan.commissions.filter((commission) => {
      if (!commission || !DAILY_COMMISSION_MAP[commission.id] || seen.has(commission.id)) return false;
      seen.add(commission.id);
      return true;
    });
  }
  if (!next.expedition) delete next.expedition;
  return ensureAssignedDailyWish(next);
}

function migrateVersion3(state: Version3GameState): GameState | null {
  if (!state.runId || !['easy', 'normal', 'hard'].includes(state.difficulty) || !['prep', 'survival', 'ended'].includes(state.phase) || !state.stats || !state.shelter || !state.inventory) return null;
  const { version: _version, shelter, ...rest } = state;
  const { storage: _storage, rawWater: existingRawWater, ...shelterRest } = shelter;
  void _version;
  void _storage;
  const recentMeals = Array.isArray(state.recentMeals) ? state.recentMeals : [];
  const migratedFatigue = state.foodFatigue ?? Object.fromEntries(
    [...new Set(recentMeals)].map((itemId) => [itemId, Math.min(100, recentMeals.filter((meal) => meal === itemId).length * 8)]),
  );
  const migratedFamilyFatigue = state.foodFamilyFatigue && Object.keys(state.foodFamilyFatigue).length
    ? state.foodFamilyFatigue
    : inferFoodFamilyFatigue(migratedFatigue);
  const next = removeStaleBatches({
    ...rest,
    version: 4,
    shelter: {
      ...shelterRest,
      // v3 mixed several water sources in one counter and did not retain enough
      // provenance to reconstruct what remains. Keep the surviving counter potable
      // rather than silently downgrade a later clean-water reward during migration.
      water: Math.max(0, Number(shelter.water) || 0),
      rawWater: Number.isFinite(existingRawWater) ? Number(existingRawWater) : 0,
    },
    foodFatigue: migratedFatigue,
    foodFamilyFatigue: migratedFamilyFatigue,
    eatenFoodIds: state.eatenFoodIds ?? [],
    ...(Number.isFinite(state.lastContactDay) ? { lastContactDay: state.lastContactDay } : {}),
  });
  return next;
}

function migrateVersion2(state: Version2GameState): GameState | null {
  if (!state.runId || !['easy', 'normal', 'hard'].includes(state.difficulty) || !['prep', 'survival', 'ended'].includes(state.phase) || !state.stats || !state.shelter || !state.inventory) return null;
  const { version: _version, outcome, ...rest } = state;
  void _version;
  const next: Version3GameState = {
    ...rest,
    version: 3,
    dailyPoints: 0,
    outcome: normalizeOutcome(outcome),
  };
  return migrateVersion3(next);
}

function migrateLegacy(state: LegacyGameState): GameState | null {
  if (!state.runId || !['prep', 'survival', 'ended'].includes(state.phase) || !state.stats || !state.shelter || !state.inventory) return null;
  const { actionPoints: _actionPoints, maxActionPoints: _maxActionPoints, version: _version, ...rest } = state;
  void _actionPoints;
  void _maxActionPoints;
  void _version;
  const flags = Array.isArray(rest.flags) ? [...rest.flags] : [];
  if (flags.includes('survived-night-14') && !flags.includes('survived-goal-night')) flags.push('survived-goal-night');
  return migrateVersion2({
    ...rest,
    version: 2,
    difficulty: 'normal',
    clockMinutes: state.phase === 'ended' ? 21 * 60 : state.phase === 'prep' ? PREP_DAY_START : SURVIVAL_DAY_START,
    furniture: createFurnitureState(),
    flags,
  });
}

export function loadGame(storage: StorageLike): GameState | null {
  const currentRaw = storage.getItem(GAME_SAVE_KEY);
  if (currentRaw !== null) {
    const current = safeParse<Partial<GameState>>(currentRaw);
    return hasValidCore(current) ? removeStaleBatches(current) : null;
  }
  const version3Raw = storage.getItem(PREVIOUS_GAME_SAVE_KEY);
  if (version3Raw !== null) {
    const version3 = safeParse<Version3GameState>(version3Raw);
    return version3?.version === 3 ? migrateVersion3(version3) : null;
  }
  const version2Raw = storage.getItem(VERSION2_GAME_SAVE_KEY);
  if (version2Raw !== null) {
    const version2 = safeParse<Version2GameState>(version2Raw);
    return version2?.version === 2 ? migrateVersion2(version2) : null;
  }
  const legacy = safeParse<LegacyGameState>(storage.getItem(LEGACY_GAME_SAVE_KEY));
  if (!legacy || legacy.version !== 1) return null;
  return migrateLegacy(legacy);
}

export function clearGame(storage: StorageLike): void {
  storage.removeItem(GAME_SAVE_KEY);
  storage.removeItem(PREVIOUS_GAME_SAVE_KEY);
  storage.removeItem(VERSION2_GAME_SAVE_KEY);
  storage.removeItem(LEGACY_GAME_SAVE_KEY);
}

export function saveMeta(storage: StorageLike, meta: MetaState): void {
  storage.setItem(META_SAVE_KEY, JSON.stringify(meta));
}

export function loadMeta(storage: StorageLike): MetaState {
  type StoredMeta = Omit<MetaState, 'achievements'> & { achievements?: string[] };
  const meta = safeParse<StoredMeta>(storage.getItem(META_SAVE_KEY));
  if (!meta || meta.version !== 1 || !Array.isArray(meta.unlocked) || !Array.isArray(meta.endings)) {
    return structuredClone(DEFAULT_META);
  }
  return {
    ...meta,
    awardedRuns: Array.isArray(meta.awardedRuns) ? meta.awardedRuns : [],
    achievements: Array.isArray(meta.achievements)
      ? [...new Set(meta.achievements.filter((id): id is AchievementId => typeof id === 'string' && Object.hasOwn(ACHIEVEMENT_MAP, id)))]
      : [],
  };
}

export function saveSettings(storage: StorageLike, settings: SettingsState): void {
  storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadSettings(storage: StorageLike): SettingsState {
  const settings = safeParse<SettingsState>(storage.getItem(SETTINGS_KEY));
  if (!settings || !['small', 'normal', 'large'].includes(settings.fontScale)) return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...settings };
}
