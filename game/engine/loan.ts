import { LOAN_MAP } from '../data/loans.ts';
import type { GameState } from '../types.ts';
import { applyEffect, createLog } from './state.ts';

export function debtRiskBonus(state: GameState): number {
  if (!state.debt || state.debt.balance <= 0) return 0;
  return LOAN_MAP[state.debt.tier].riskBonus + Math.min(8, state.debt.missedCollections * 2);
}

export function assessDebtNight(state: GameState): GameState {
  if (state.phase !== 'survival' || !state.debt || state.debt.balance <= 0) return state;
  let next = structuredClone(state);
  const debt = next.debt!;
  const definition = LOAN_MAP[debt.tier];
  if (next.survivalDay < debt.dueSurvivalDay) {
    if (next.survivalDay === 1 || next.survivalDay === debt.dueSurvivalDay - 1) {
      next.logs.push(createLog(next, '催收提醒', `备用手机收到一条定时短信：尚欠 ¥${debt.balance}，封锁第 ${debt.dueSurvivalDay} 天到期。对方显然早就准备好了离线催收名单。`, 'system'));
    }
    return next;
  }
  debt.missedCollections += 1;
  debt.balance += definition.overdueFee;
  next = applyEffect(next, { stats: { morale: debt.tier === 'desperate' ? -7 : -4 }, shelter: debt.missedCollections >= 2 ? { integrity: -3 } : undefined }, '逾期催收');
  next.logs.push(createLog(next, `逾期催收 · 第 ${debt.missedCollections} 次`, `债务增加 ¥${definition.overdueFee}，当前余额 ¥${debt.balance}。${debt.missedCollections === 1 ? '楼道里有人逐户核对门牌。' : '门外留下了新的敲击痕迹，催收者已经知道这间屋里有人。'}未结清债务使所有危险判定额外增加 ${debtRiskBonus(next)} 点。`, 'bad'));
  return next;
}
