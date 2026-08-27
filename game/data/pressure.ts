import { DIFFICULTY_MAP } from './difficulties.ts';
import type { DifficultyId } from '../types.ts';

export interface SurvivalPressureProfile {
  stage: 'routine' | 'siege' | 'collapse' | 'evacuation';
  name: string;
  description: string;
  foodDrain: number;
  waterDrain: number;
  staminaRecovery: number;
  moraleDrain: number;
  activityFoodPerTwoHours: number;
  activityWaterPerTwoHours: number;
}

/**
 * All recurring survival costs live here so UI previews, the engine and balance
 * tests read the same numbers. Hard mode deliberately changes after day 8:
 * guarding the building costs sleep, food and water even when a wave is blocked.
 */
export function survivalPressure(difficulty: DifficultyId, survivalDay: number): SurvivalPressureProfile {
  const config = DIFFICULTY_MAP[difficulty];
  const baseFood = Math.round(18 * config.nightCostMultiplier);
  const baseWater = Math.round(24 * config.nightCostMultiplier);

  if (difficulty === 'easy') return {
    stage: 'routine',
    name: '宽松配给',
    description: '睡眠恢复稳定，长时间行动只产生少量额外消耗。',
    foodDrain: baseFood,
    waterDrain: baseWater,
    staminaRecovery: 32,
    moraleDrain: 0,
    activityFoodPerTwoHours: 1,
    activityWaterPerTwoHours: 1,
  };

  if (difficulty === 'normal') return {
    stage: 'routine',
    name: '标准配给',
    description: '外出和劳动会随经过的时间增加食水消耗。',
    foodDrain: baseFood,
    waterDrain: baseWater,
    staminaRecovery: 26,
    moraleDrain: 2,
    activityFoodPerTwoHours: 1,
    activityWaterPerTwoHours: 2,
  };

  if (survivalDay >= 13) return {
    stage: 'evacuation',
    name: '撤离前崩溃',
    description: '连续守夜已打断正常睡眠，最后两天的配给和体力压力达到峰值。',
    foodDrain: baseFood + 8,
    waterDrain: baseWater + 10,
    staminaRecovery: 12,
    moraleDrain: 7,
    activityFoodPerTwoHours: 2,
    activityWaterPerTwoHours: 2,
  };

  if (survivalDay >= 11) return {
    stage: 'collapse',
    name: '防线疲劳',
    description: '换班人手减少，睡眠和配给都无法再按前期标准维持。',
    foodDrain: baseFood + 6,
    waterDrain: baseWater + 8,
    staminaRecovery: 14,
    moraleDrain: 6,
    activityFoodPerTwoHours: 2,
    activityWaterPerTwoHours: 2,
  };

  if (survivalDay >= 8) return {
    stage: 'siege',
    name: '连续围攻',
    description: '主潮迫使你轮流守夜，夜间恢复下降，食水消耗上升。',
    foodDrain: baseFood + 3,
    waterDrain: baseWater + 4,
    staminaRecovery: 18,
    moraleDrain: 5,
    activityFoodPerTwoHours: 2,
    activityWaterPerTwoHours: 2,
  };

  return {
    stage: 'routine',
    name: '紧缩配给',
    description: '基础消耗较高，长时间行动还会产生额外食水需求。',
    foodDrain: baseFood,
    waterDrain: baseWater,
    staminaRecovery: 22,
    moraleDrain: 4,
    activityFoodPerTwoHours: 2,
    activityWaterPerTwoHours: 2,
  };
}

export function wishPointsForDifficulty(difficulty: DifficultyId): number {
  return difficulty === 'easy' ? 2 : 1;
}

export function activeContactLimit(difficulty: DifficultyId): number {
  return difficulty === 'easy' ? 4 : difficulty === 'normal' ? 3 : 2;
}

export function workIncome(difficulty: DifficultyId): number {
  return difficulty === 'easy' ? 170 : difficulty === 'normal' ? 140 : 115;
}

export function makeshiftRepairAmount(difficulty: DifficultyId): number {
  return difficulty === 'easy' ? 4 : difficulty === 'normal' ? 3 : 2;
}
