import { POWER_POLICY_MAP } from '../data/power.ts';
import type { GameState, PowerPolicy } from '../types.ts';
import { createLog } from './state.ts';

export function powerUpgradeSpec(state: GameState): { level: number; money: number; minutes: number; power: number; name: string } | null {
  const level = state.shelter.generator;
  if (level >= 3) return null;
  const powerByDifficulty = state.difficulty === 'easy' ? [10, 12, 10] : state.difficulty === 'hard' ? [5, 6, 5] : [7, 8, 7];
  if (level === 0) return { level: 1, money: 110, minutes: 180, power: powerByDifficulty[0], name: '安装备用切换箱' };
  if (level === 1) return { level: 2, money: 90, minutes: 120, power: powerByDifficulty[1], name: '增加蓄电模组' };
  return { level: 3, money: 120, minutes: 120, power: powerByDifficulty[2], name: '铺设独立冷藏回路' };
}

export function setPowerPolicy(state: GameState, policy: PowerPolicy): { state: GameState; ok: boolean; message?: string } {
  const definition = POWER_POLICY_MAP[policy];
  if (!definition || state.phase === 'ended') return { state, ok: false, message: '当前无法修改供电策略。' };
  if (state.powerPolicy === policy) return { state, ok: false, message: '已经采用这项供电策略。' };
  const next = structuredClone(state);
  next.powerPolicy = policy;
  next.feedback = [];
  next.logs.push(createLog(next, `供电策略 · ${definition.name}`, `预计每晚使用 ${definition.expectedPower} 点备用电。${definition.description}策略可以随时调整，不消耗游戏时间。`, 'system'));
  return { state: next, ok: true };
}

export function projectedPowerNights(state: GameState): number | null {
  const alarmCost = state.phase === 'survival' && state.difficulty === 'hard' && state.survivalDay >= 8 ? 1 : 0;
  const cost = POWER_POLICY_MAP[state.powerPolicy].expectedPower + alarmCost;
  return cost === 0 ? null : Math.floor(state.shelter.power / cost);
}
