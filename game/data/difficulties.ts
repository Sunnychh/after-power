import type { DifficultyId, EventEffect } from '../types.ts';

export interface DifficultyDefinition {
  id: DifficultyId;
  name: string;
  tagline: string;
  description: string;
  startMoney: number;
  carryCapacity: number;
  startingShelter: EventEffect['shelter'];
  startingInventory: Record<string, number>;
  riskModifier: number;
  lootBonus: number;
  nightCostMultiplier: number;
  shelterDamageMultiplier: number;
  survivalGoalDays: number;
  truthDecisionDay: number;
  prepDayEnd: number;
  survivalDayEnd: number;
}

export const DIFFICULTIES: DifficultyDefinition[] = [
  {
    id: 'easy',
    name: '简易',
    tagline: '轻松囤货 · 推荐初次游玩',
    description: '现金和基础物资更充足，白天更长，探索危险更低；第 10 夜即可等到撤离。',
    startMoney: 720,
    carryCapacity: 92,
    startingShelter: { integrity: 60, water: 12, power: 14, fuel: 10, storage: 90, generator: 1 },
    startingInventory: {
      'water-bottle': 4,
      crackers: 3,
      'canned-beans': 2,
      'instant-noodles': 2,
      bandage: 2,
      batteries: 2,
      masks: 1,
      oats: 1,
      'milk-powder': 1,
      'dried-vegetables': 1,
    },
    riskModifier: -18,
    lootBonus: 1,
    nightCostMultiplier: 0.7,
    shelterDamageMultiplier: 0.65,
    survivalGoalDays: 10,
    truthDecisionDay: 8,
    prepDayEnd: 23 * 60,
    survivalDayEnd: 22 * 60,
  },
  {
    id: 'normal',
    name: '标准',
    tagline: '完整压力 · 原始节奏',
    description: '物资需要规划使用，重复探索收益会衰减；第 14 夜后开放普通撤离。',
    startMoney: 420,
    carryCapacity: 66,
    startingShelter: { integrity: 45 },
    startingInventory: {},
    riskModifier: 0,
    lootBonus: 0,
    nightCostMultiplier: 1.05,
    shelterDamageMultiplier: 1,
    survivalGoalDays: 14,
    truthDecisionDay: 12,
    prepDayEnd: 22 * 60,
    survivalDayEnd: 21 * 60,
  },
  {
    id: 'hard',
    name: '艰难',
    tagline: '紧缺开局 · 危险加剧',
    description: '现金、负重和探索产出都更紧，重复搜刮可能空手而归。',
    startMoney: 290,
    carryCapacity: 58,
    startingShelter: { integrity: 38 },
    startingInventory: { 'water-bottle': 1 },
    riskModifier: 10,
    lootBonus: -1,
    nightCostMultiplier: 1.25,
    shelterDamageMultiplier: 1.3,
    survivalGoalDays: 14,
    truthDecisionDay: 12,
    prepDayEnd: 21 * 60,
    survivalDayEnd: 20 * 60,
  },
];

export const DIFFICULTY_MAP: Record<DifficultyId, DifficultyDefinition> = Object.fromEntries(
  DIFFICULTIES.map((difficulty) => [difficulty.id, difficulty]),
) as Record<DifficultyId, DifficultyDefinition>;
