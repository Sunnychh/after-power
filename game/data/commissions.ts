import type { DailyCommissionId, Phase } from '../types.ts';

export interface DailyCommissionDefinition {
  id: DailyCommissionId;
  phase: 'prep' | 'survival';
  name: string;
  description: string;
  matchingActions: string[];
}

export const DAILY_COMMISSIONS: DailyCommissionDefinition[] = [
  { id: 'earn-cash', phase: 'prep', name: '补足现金缺口', description: '完成一次临时工作。', matchingActions: ['prep:work'] },
  { id: 'visit-store', phase: 'prep', name: '核对一处货源', description: '进入任意一家商店或完成最后采购。', matchingActions: ['prep:visit-store', 'prep:risky-shopping'] },
  { id: 'gather-intel', phase: 'prep', name: '确认一条消息', description: '调查灾难情报或进行停电演练。', matchingActions: ['prep:investigate', 'prep:drill'] },
  { id: 'restore-self', phase: 'survival', name: '把状态拉回来', description: '休息或完成任意娱乐项目。', matchingActions: ['survival:rest', 'survival:entertainment:'] },
  { id: 'make-meal', phase: 'survival', name: '做一份热食', description: '使用任意厨具完成一次烹饪尝试。', matchingActions: ['furniture:'] },
  { id: 'check-radio', phase: 'survival', name: '守住信息频道', description: '完成一次有效的广播收听。', matchingActions: ['survival:radio'] },
  { id: 'return-expedition', phase: 'survival', name: '从街区平安返回', description: '完成一次地点探索并撤回避难所。', matchingActions: ['survival:explore'] },
  { id: 'maintain-shelter', phase: 'survival', name: '处理一处防线缺口', description: '修缮、加固或建设电力陷阱。', matchingActions: ['survival:repair', 'survival:barricade', 'survival:plate', 'survival:power-trap'] },
  { id: 'contact-survivor', phase: 'survival', name: '主动确认一个人还活着', description: '完成一次主动联络或交易。', matchingActions: ['survival:contact:', 'survival:trade:'] },
];

export const DAILY_COMMISSION_MAP = Object.fromEntries(DAILY_COMMISSIONS.map((commission) => [commission.id, commission])) as Record<DailyCommissionId, DailyCommissionDefinition>;

export function commissionsForPhase(phase: Phase): DailyCommissionDefinition[] {
  if (phase === 'ended') return [];
  return DAILY_COMMISSIONS.filter((commission) => commission.phase === phase);
}
