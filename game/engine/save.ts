import { createFurnitureState } from '../data/furniture.ts';
import type { GameState, MetaState, Outcome, SettingsState, StorageLike } from '../types.ts';
import { expireItems } from './inventory.ts';
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
    && Array.isArray(state.logs),
  );
}

function removeStaleBatches(state: GameState): GameState {
  const next = structuredClone(state);
  next.inventory = expireItems(next.inventory, absoluteDay(next)).inventory;
  return next;
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
