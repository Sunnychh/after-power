import type { LoanTier } from '../types.ts';

export interface LoanDefinition {
  id: LoanTier;
  name: string;
  cashAdvance: number;
  startingDebt: number;
  dueSurvivalDay: number;
  minimumPayment: number;
  riskBonus: number;
  overdueFee: number;
  description: string;
}

export const LOANS: LoanDefinition[] = [
  { id: 'none', name: '不借贷', cashAdvance: 0, startingDebt: 0, dueSurvivalDay: 0, minimumPayment: 0, riskBonus: 0, overdueFee: 0, description: '按现有现金准备，不承担末日期间的催收与危险加成。' },
  { id: 'bridge', name: '短期周转', cashAdvance: 280, startingDebt: 360, dueSurvivalDay: 5, minimumPayment: 80, riskBonus: 4, overdueFee: 28, description: '开局 +¥280；封锁第 5 天到期。未还清会产生滞纳金、催收压力和外出风险。' },
  { id: 'desperate', name: '高息应急款', cashAdvance: 520, startingDebt: 760, dueSurvivalDay: 4, minimumPayment: 120, riskBonus: 8, overdueFee: 48, description: '开局 +¥520；封锁第 4 天到期。催收更早、更频繁，危险加成也更高。' },
];

export const LOAN_MAP = Object.fromEntries(LOANS.map((loan) => [loan.id, loan])) as Record<LoanTier, LoanDefinition>;
