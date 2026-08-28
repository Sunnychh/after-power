import { DIFFICULTY_MAP } from '../data/difficulties.ts';
import { survivalPressure } from '../data/pressure.ts';
import type { GameState } from '../types.ts';
import { AUTO_RATION_TARGET, forecastAutomaticRations } from './rations.ts';
import { hasFlag } from './state.ts';

export interface NightNeedStress {
  moralePenalty: number;
  staminaPenalty: number;
  reasons: string[];
}

export interface SurvivalNeedAlert {
  severity: 'warning' | 'critical';
  title: string;
  detail: string;
  projectedSatiety: number;
  projectedHydration: number;
  rationCanCover: boolean;
}

function foodStress(value: number): { morale: number; stamina: number; label?: string } {
  if (value <= 0) return { morale: 5, stamina: 6, label: '空腹已经影响睡眠和判断' };
  if (value <= 20) return { morale: 3, stamina: 3, label: '严重饥饿使人烦躁、难以恢复体力' };
  if (value <= 40) return { morale: 1, stamina: 0, label: '持续饥饿带来心理压力' };
  return { morale: 0, stamina: 0 };
}

function waterStress(value: number): { morale: number; stamina: number; label?: string } {
  if (value <= 0) return { morale: 7, stamina: 8, label: '脱水让思绪和睡眠一起崩坏' };
  if (value <= 20) return { morale: 4, stamina: 5, label: '严重缺水带来焦虑、头痛与乏力' };
  if (value <= 40) return { morale: 2, stamina: 0, label: '口渴让人无法安稳入睡' };
  return { morale: 0, stamina: 0 };
}

/** One nightly psychological cost, computed after rations and weather. */
export function calculateNightNeedStress(state: GameState): NightNeedStress {
  const food = foodStress(state.stats.satiety);
  const water = waterStress(state.stats.hydration);
  const reasons = [food.label, water.label].filter((label): label is string => Boolean(label));
  const boredom = state.foodBoredom >= 90 ? 3 : state.foodBoredom >= 75 ? 2 : state.foodBoredom >= 60 ? 1 : 0;
  if (boredom) reasons.push(`饮食厌倦 ${state.foodBoredom}/100 仍在积累`);
  const steadyRelief = hasFlag(state, 'ability:steady') ? 2 : 0;
  return {
    moralePenalty: Math.min(10, Math.max(0, food.morale + water.morale + boredom - steadyRelief)),
    staminaPenalty: Math.min(10, food.stamina + water.stamina),
    reasons,
  };
}

/** Persistent UI warning based on both the current value and the next base night drain. */
export function survivalNeedAlert(state: GameState): SurvivalNeedAlert | null {
  if (state.phase !== 'survival') return null;
  const pressure = survivalPressure(state.difficulty, Math.max(1, state.survivalDay));
  const heatWater = state.weather === '闷热' ? Math.round(7 * DIFFICULTY_MAP[state.difficulty].nightCostMultiplier) : 0;
  const projectedSatiety = Math.max(0, state.stats.satiety - pressure.foodDrain);
  const projectedHydration = Math.max(0, state.stats.hydration - pressure.waterDrain - heatWater);
  const warningNow = state.stats.satiety <= 40 || state.stats.hydration <= 40;
  const warningTonight = projectedSatiety <= 35 || projectedHydration <= 35;
  if (!warningNow && !warningTonight) return null;

  const rationForecast = forecastAutomaticRations(state, projectedSatiety, projectedHydration);
  const rationCanCover = rationForecast.stats.satiety >= AUTO_RATION_TARGET
    && rationForecast.stats.hydration >= AUTO_RATION_TARGET;
  const critical = state.stats.satiety <= 20 || state.stats.hydration <= 20
    || (!state.autoRations && (projectedSatiety <= 20 || projectedHydration <= 20))
    || (state.autoRations && !rationCanCover && (projectedSatiety <= 20 || projectedHydration <= 20));
  const current = `当前饱腹 ${state.stats.satiety}、水分 ${state.stats.hydration}；按基础夜耗预计降至 ${projectedSatiety}/${projectedHydration}。`;
  const consequence = '低于 35 会提高危险率，低于 40 的饥渴还会在夜间额外损失精神，严重时同时损失健康与睡眠恢复。';
  const ration = state.autoRations
    ? rationCanCover
      ? '自动补充已开启，库存足够时会尝试补到 60；白天继续行动仍会产生消耗。'
      : '自动补充已开启，但现有食物或饮水不足以补到 60，请尽快手动处理或寻找物资。'
    : '自动补充已关闭，请打开物资手动食用；也可在设置中随时开启。';
  return {
    severity: critical ? 'critical' : 'warning',
    title: critical ? '生理状态已进入危险线' : '今晚的食水余量偏低',
    detail: `${current}${ration}${consequence}`,
    projectedSatiety,
    projectedHydration,
    rationCanCover,
  };
}
