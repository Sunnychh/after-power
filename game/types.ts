export type Phase = 'prep' | 'survival' | 'ended';
export type Weather = '晴冷' | '闷热' | '酸雨' | '暴雨' | '大雾' | '寒潮';
export type DifficultyId = 'easy' | 'normal' | 'hard';

export type StatKey = 'satiety' | 'hydration' | 'health' | 'morale' | 'stamina';
export type ShelterKey = 'integrity' | 'water' | 'power' | 'fuel' | 'reinforcement' | 'storage' | 'generator';

export interface CoreStats {
  satiety: number;
  hydration: number;
  health: number;
  morale: number;
  stamina: number;
}

export interface ShelterState {
  integrity: number;
  water: number;
  power: number;
  fuel: number;
  reinforcement: number;
  storage: number;
  generator: number;
}

export type ItemCategory = '食物' | '饮水' | '药品' | '工具' | '能源' | '防护' | '材料' | '特殊';
export type StoreId = 'market' | 'pharmacy' | 'hardware' | 'fuel';

export interface ItemDefinition {
  id: string;
  name: string;
  category: ItemCategory;
  price: number;
  weight: number;
  description: string;
  store?: StoreId;
  perishableDays?: number;
  expiredLabel?: string;
  usable?: boolean;
  effects?: Partial<CoreStats> & { water?: number; power?: number; fuel?: number; integrity?: number };
  tags?: string[];
  story?: boolean;
  easyPlan?: { tier: '必备' | '推荐'; target: number };
}

export interface InventoryBatch {
  quantity: number;
  acquiredOn: number;
  expiresOn?: number;
}

export type Inventory = Record<string, InventoryBatch[]>;

export interface NpcDefinition {
  id: string;
  name: string;
  role: string;
  stance: string;
  description: string;
}

export interface LocationDefinition {
  id: string;
  name: string;
  district: string;
  risk: number;
  description: string;
  loot: string[];
  uniqueItem?: string;
}

export interface Requirement {
  item?: string;
  quantity?: number;
  flag?: string;
  minStat?: Partial<Record<StatKey, number>>;
  minIntel?: number;
}

export interface EventEffect {
  stats?: Partial<Record<StatKey, number>>;
  shelter?: Partial<Record<ShelterKey, number>>;
  inventory?: Record<string, number>;
  money?: number;
  intel?: number;
  relationships?: Record<string, number>;
  addFlags?: string[];
  removeFlags?: string[];
  injury?: string;
  memory?: number;
}

export interface EventOption {
  label: string;
  hint: string;
  result: string;
  requirements?: Requirement[];
  effects?: EventEffect;
  danger?: number;
}

export interface GameEvent {
  id: string;
  title: string;
  text: string;
  phase: 'prep' | 'survival' | 'both';
  minDay?: number;
  maxDay?: number;
  weather?: Weather[];
  requiresFlags?: string[];
  excludesFlags?: string[];
  chain?: { id: string; step: number };
  npc?: string;
  options: EventOption[];
}

export interface LogEntry {
  id: string;
  dayLabel: string;
  title: string;
  body: string;
  tone: 'story' | 'good' | 'bad' | 'system';
}

export interface FeedbackItem {
  id: string;
  label: string;
  delta: number;
  reason: string;
}

export type FurnitureId = 'fridge' | 'gas-stove' | 'microwave' | 'electric-hotpot';

export interface FurnitureUnitState {
  condition: number;
  enabled: boolean;
  lastUsedDay?: number;
}

export type FurnitureState = Record<FurnitureId, FurnitureUnitState>;

export type OutcomeId = 'death' | 'survivor' | 'truth';

export interface Outcome {
  id: OutcomeId;
  variantId: string;
  title: string;
  text: string;
  memoryEarned: number;
  keyChoices: string[];
}

export type DailyWishId = 'prep-income' | 'prep-home' | 'prep-contact' | 'survival-explore' | 'survival-care' | 'survival-secure';
export type DailyDeadlineId = 'early' | 'steady' | 'open';
export type DailyRewardId = 'quiet-rest' | 'water-cache' | 'food-cache' | 'repair-kit' | 'charge-pack' | 'first-aid';

export interface DailyPlan {
  dayKey: string;
  wishId: DailyWishId;
  deadlineId?: DailyDeadlineId;
  completedAtMinutes?: number;
  actions: string[];
}

export interface DailySettlement {
  id: string;
  dayKey: string;
  dayLabel: string;
  wishId: DailyWishId;
  wishAchieved: boolean;
  wishPoints: number;
  deadlineId: DailyDeadlineId;
  deadlineAchieved: boolean;
  deadlinePoints: number;
  basePoints: number;
  earnedPoints: number;
  completedAtMinutes?: number;
  endedAtMinutes: number;
  rewardChoices: DailyRewardId[];
  finalNight: boolean;
}

export interface GameState {
  version: 3;
  runId: string;
  seed: number;
  rngState: number;
  difficulty: DifficultyId;
  autoRations: boolean;
  phase: Phase;
  prepDay: number;
  survivalDay: number;
  clockMinutes: number;
  money: number;
  stats: CoreStats;
  shelter: ShelterState;
  furniture: FurnitureState;
  inventory: Inventory;
  carryCapacity: number;
  weather: Weather;
  intel: number;
  broadcasts: number;
  relationships: Record<string, number>;
  injuries: string[];
  flags: string[];
  seenEvents: string[];
  visited: Record<string, number>;
  currentEventId?: string;
  logs: LogEntry[];
  feedback: FeedbackItem[];
  tutorialStep: number;
  dailyPoints: number;
  dailyPlan?: DailyPlan;
  dailySettlement?: DailySettlement;
  outcome?: Outcome;
}

export type AbilityId = 'packer' | 'map' | 'steady';

export interface MetaState {
  version: 1;
  memory: number;
  runs: number;
  unlocked: AbilityId[];
  endings: OutcomeId[];
  awardedRuns: string[];
}

export interface SettingsState {
  shortcuts: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  fontScale: 'small' | 'normal' | 'large';
  tutorial: boolean;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
