export type Phase = 'prep' | 'survival' | 'ended';
export type Weather = '晴冷' | '闷热' | '酸雨' | '暴雨' | '大雾' | '寒潮';
export type DifficultyId = 'easy' | 'normal' | 'hard';
export type LoanTier = 'none' | 'bridge' | 'desperate';
export type PowerPolicy = 'balanced' | 'cold' | 'light' | 'off';

export interface PowerTrapState {
  level: number;
  armed: boolean;
}

export type StatKey = 'satiety' | 'hydration' | 'health' | 'morale' | 'stamina';
export type ShelterKey = 'integrity' | 'water' | 'rawWater' | 'power' | 'fuel' | 'reinforcement' | 'generator';

export interface CoreStats {
  satiety: number;
  hydration: number;
  health: number;
  morale: number;
  stamina: number;
}

export interface ShelterState {
  integrity: number;
  /** Drinkable water in labelled shelter containers. */
  water: number;
  /** Collected rain/leak water. It must be purified before use. */
  rawWater: number;
  power: number;
  fuel: number;
  reinforcement: number;
  generator: number;
}

export type ItemCategory = '食物' | '饮水' | '药品' | '工具' | '能源' | '防护' | '材料' | '特殊';
export type StoreId = 'market' | 'pharmacy' | 'hardware' | 'fuel';

export interface ShoppingTrip {
  store: StoreId;
  prepDay: number;
  carriedWeight: number;
  capacity: number;
}

export interface DebtState {
  tier: Exclude<LoanTier, 'none'>;
  borrowed: number;
  balance: number;
  dueSurvivalDay: number;
  minimumPayment: number;
  missedCollections: number;
  totalRepaid: number;
}

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
  talentName: string;
  talentDescription: string;
  allianceThreshold: number;
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
  /** This particular choice contains a live human exchange. */
  countsAsContact?: boolean;
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
  difficulties?: DifficultyId[];
  inventoryAny?: string[];
  hardStockPressure?: boolean;
  requiresFlags?: string[];
  excludesFlags?: string[];
  chain?: { id: string; step: number };
  npc?: string;
  /** The scene is heard through the player's own radio, not a nearby device or loudspeaker. */
  requiresRadio?: boolean;
  /** Every resolution of this scene confirms live human contact. */
  countsAsContact?: boolean;
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

export type ExplorationSkillId = 'lockpicking' | 'toolUse' | 'search';

export interface SkillProgress {
  level: number;
  xp: number;
}

export type ExplorationSkills = Record<ExplorationSkillId, SkillProgress>;

export interface ExpeditionState {
  locationId: string;
  sceneId: string;
  startedAtMinutes: number;
  discoveredScenes: string[];
  gathered: string[];
}

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
export type DailyCommissionId = 'earn-cash' | 'visit-store' | 'gather-intel' | 'restore-self' | 'make-meal' | 'check-radio' | 'return-expedition' | 'maintain-shelter' | 'contact-survivor';

export interface DailyCommissionProgress {
  id: DailyCommissionId;
  completedAtMinutes?: number;
  pointsAwarded?: number;
}

export interface DailyPlan {
  dayKey: string;
  wishId: DailyWishId;
  deadlineId?: DailyDeadlineId;
  completedAtMinutes?: number;
  actions: string[];
  commissions?: DailyCommissionProgress[];
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
  commissionPoints?: number;
  completedAtMinutes?: number;
  endedAtMinutes: number;
  rewardChoices: DailyRewardId[];
  finalNight: boolean;
}

export interface GameState {
  version: 4;
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
  debt?: DebtState;
  stats: CoreStats;
  shelter: ShelterState;
  powerPolicy: PowerPolicy;
  powerTrap: PowerTrapState;
  furniture: FurnitureState;
  inventory: Inventory;
  carryCapacity: number;
  weather: Weather;
  intel: number;
  broadcasts: number;
  /** Absolute day of the latest live exchange; old broadcasts do not prevent isolation forever. */
  lastContactDay?: number;
  cookingAttempts: number;
  cookingSkill: number;
  discoveredRecipes: string[];
  foodBoredom: number;
  /** Persistent familiarity for each food. It fades slowly instead of resetting when meals alternate. */
  foodFatigue: Record<string, number>;
  /** Broader taste/texture fatigue shared by related foods, such as two kinds of noodles. */
  foodFamilyFatigue: Record<string, number>;
  /** A permanent run-level record so an old food cannot become "first-time" again after a short break. */
  eatenFoodIds: string[];
  recentMeals: string[];
  explorationSkills: ExplorationSkills;
  expedition?: ExpeditionState;
  isolationNights: number;
  storePurchases: Record<string, number>;
  shoppingTrip?: ShoppingTrip;
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

export type AchievementId =
  | 'first-night'
  | 'district-scout'
  | 'city-cartographer'
  | 'field-specialist'
  | 'first-recipe'
  | 'seasoned-cook'
  | 'recipe-collector'
  | 'recipe-master'
  | 'pantry-variety'
  | 'shelter-ready'
  | 'all-rounder'
  | 'broadcast-circle'
  | 'long-haul'
  | 'first-alliance'
  | 'full-coalition'
  | 'easy-survivor'
  | 'easy-good-life'
  | 'easy-coalition'
  | 'normal-survivor'
  | 'normal-manual-survivor'
  | 'normal-balanced'
  | 'live-wire'
  | 'hard-survivor'
  | 'hard-debt-cleared'
  | 'difficulty-triad'
  | 'ending-death'
  | 'ending-survivor'
  | 'ending-truth'
  | 'ending-collection';

export interface MetaState {
  version: 1;
  memory: number;
  runs: number;
  unlocked: AbilityId[];
  endings: OutcomeId[];
  awardedRuns: string[];
  achievements: AchievementId[];
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
