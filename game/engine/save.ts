import { createFurnitureState } from '../data/furniture.ts';
import { DEEP_LOCATIONS } from '../data/deep-exploration.ts';
import { ITEM_MAP } from '../data/items.ts';
import type { GameState, MetaState, Outcome, SettingsState, StorageLike } from '../types.ts';
import { expireItems } from './inventory.ts';
import { ensureAssignedDailyWish } from './daily.ts';
import { createAssignedDailyPlan } from './wish-plan.ts';
import {
  absoluteDay,
  DEFAULT_META,
  GAME_SAVE_KEY,
  LEGACY_GAME_SAVE_KEY,
  META_SAVE_KEY,
  PREVIOUS_GAME_SAVE_KEY,
  SETTINGS_KEY,
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
  storage.removeItem(LEGACY_GAME_SAVE_KEY);
}

type LegacyOutcome = Omit<Outcome, 'variantId' | 'keyChoices'> & {
  variantId?: string;
  keyChoices?: string[];
};

type Version2GameState = Omit<GameState, 'version' | 'dailyPoints' | 'dailyPlan' | 'dailySettlement' | 'outcome'> & {
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
    && state.version === 3
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

function removeStaleBatches(state: GameState): GameState {
  const next = structuredClone(state);
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
  if (!Array.isArray(next.recentMeals)) next.recentMeals = [];
  next.recentMeals = next.recentMeals.filter((itemId) => typeof itemId === 'string' && Boolean(ITEM_MAP[itemId])).slice(-6);
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
  if (!next.storePurchases || typeof next.storePurchases !== 'object') next.storePurchases = {};
  if (next.debt && (!Number.isFinite(next.debt.balance) || next.debt.balance <= 0)) next.debt = undefined;
  if (next.shoppingTrip && (
    !['market', 'pharmacy', 'hardware', 'fuel'].includes(next.shoppingTrip.store)
    || next.shoppingTrip.prepDay !== next.prepDay
    || !Number.isFinite(next.shoppingTrip.carriedWeight)
    || !Number.isFinite(next.shoppingTrip.capacity)
  )) next.shoppingTrip = undefined;
  next.inventory = expireItems(next.inventory, absoluteDay(next)).inventory;
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
  }
  if (!next.expedition) delete next.expedition;
  return ensureAssignedDailyWish(next);
}

function migrateVersion2(state: Version2GameState): GameState | null {
  if (!state.runId || !['easy', 'normal', 'hard'].includes(state.difficulty) || !['prep', 'survival', 'ended'].includes(state.phase) || !state.stats || !state.shelter || !state.inventory) return null;
  const { version: _version, outcome, ...rest } = state;
  void _version;
  const next: GameState = {
    ...rest,
    version: 3,
    dailyPoints: 0,
    outcome: normalizeOutcome(outcome),
  };
  return removeStaleBatches(next);
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
  const version2Raw = storage.getItem(PREVIOUS_GAME_SAVE_KEY);
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
  storage.removeItem(LEGACY_GAME_SAVE_KEY);
}

export function saveMeta(storage: StorageLike, meta: MetaState): void {
  storage.setItem(META_SAVE_KEY, JSON.stringify(meta));
}

export function loadMeta(storage: StorageLike): MetaState {
  const meta = safeParse<MetaState>(storage.getItem(META_SAVE_KEY));
  if (!meta || meta.version !== 1 || !Array.isArray(meta.unlocked) || !Array.isArray(meta.endings)) {
    return structuredClone(DEFAULT_META);
  }
  return { ...meta, awardedRuns: Array.isArray(meta.awardedRuns) ? meta.awardedRuns : [] };
}

export function saveSettings(storage: StorageLike, settings: SettingsState): void {
  storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadSettings(storage: StorageLike): SettingsState {
  const settings = safeParse<SettingsState>(storage.getItem(SETTINGS_KEY));
  if (!settings || !['small', 'normal', 'large'].includes(settings.fontScale)) return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...settings };
}
