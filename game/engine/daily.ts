import {
  DAILY_REWARD_MAP,
  DAILY_WISH_MAP,
} from '../data/daily.ts';
import type {
  DailyRewardId,
  DailySettlement,
  DailyWishId,
  GameState,
} from '../types.ts';
import { absoluteDay, applyEffect, createLog, dayLabel } from './state.ts';
import { formatClock } from './time.ts';
import { createAssignedDailyPlan, wishDayKey } from './wish-plan.ts';

export type DailyResult = { state: GameState; ok: boolean; message?: string };

export function currentDayKey(state: GameState): string {
  return wishDayKey(state);
}

export function dailyActionBlockedReason(state: GameState): string | null {
  if (state.phase === 'ended') return '本轮已经结束。';
  if (state.dailySettlement) return '先确认昨夜的愿望结算。';
  if (state.flags.includes('evacuation-choice-pending')) return '撤离通道已经开放，请先决定离城路线。';
  if (!state.dailyPlan) return '今日愿望尚未生成，请重新载入存档。';
  return null;
}

export function ensureAssignedDailyWish(state: GameState, forcedWishId?: DailyWishId): GameState {
  if (state.phase === 'ended' || state.dailySettlement || state.flags.includes('evacuation-choice-pending')) return state;
  const expectedDayKey = currentDayKey(state);
  const currentWish = state.dailyPlan ? DAILY_WISH_MAP[state.dailyPlan.wishId] : undefined;
  if (state.dailyPlan?.dayKey === expectedDayKey && currentWish?.phase === state.phase && state.dailyPlan.deadlineId === 'open' && !forcedWishId) {
    return state;
  }
  const next = structuredClone(state);
  next.dailyPlan = createAssignedDailyPlan(next, forcedWishId);
  return next;
}

function actionMatches(wishId: DailyWishId, actionId: string): boolean {
  return DAILY_WISH_MAP[wishId].matchingActions.some((candidate) => (
    candidate.endsWith(':') ? actionId.startsWith(candidate) : actionId === candidate
  ));
}

export function recordDailyAction(state: GameState, actionId: string): GameState {
  if (!state.dailyPlan || state.dailyPlan.completedAtMinutes !== undefined) return state;
  const next = structuredClone(state);
  next.dailyPlan!.actions.push(actionId);
  if (!actionMatches(next.dailyPlan!.wishId, actionId)) return next;
  next.dailyPlan!.completedAtMinutes = next.clockMinutes;
  const wish = DAILY_WISH_MAP[next.dailyPlan!.wishId];
  next.logs = [...next.logs, createLog(
    next,
    '今日愿望已达成',
    `“${wish.name}”在 ${formatClock(next.clockMinutes)} 完成。愿望点会在今晚结算。`,
    'good',
  )];
  return next;
}

export function dailyWishProgress(state: GameState): string {
  if (!state.dailyPlan) return '今日愿望尚未生成';
  if (state.dailyPlan.completedAtMinutes !== undefined) return `${formatClock(state.dailyPlan.completedAtMinutes)} 已达成`;
  return '进行中 · 今天结束前完成即可';
}

function rewardChoicesForDay(state: GameState): DailyRewardId[] {
  const rotating: DailyRewardId[] = ['water-cache', 'food-cache', 'repair-kit', 'charge-pack', 'first-aid'];
  const index = (absoluteDay(state) + state.seed) % rotating.length;
  return ['quiet-rest', rotating[index], rotating[(index + 2) % rotating.length]];
}

export function createDailySettlement(beforeNight: GameState, afterNight: GameState, finalNight: boolean): GameState {
  const plan = beforeNight.dailyPlan;
  if (!plan) return afterNight;
  const wish = DAILY_WISH_MAP[plan.wishId];
  const wishAchieved = plan.completedAtMinutes !== undefined;
  const basePoints = 0;
  const wishPoints = wishAchieved ? wish.rewardPoints : 0;
  const deadlinePoints = 0;
  const earnedPoints = wishPoints;
  const settlement: DailySettlement = {
    id: `${beforeNight.runId}-${plan.dayKey}`,
    dayKey: plan.dayKey,
    dayLabel: dayLabel(beforeNight),
    wishId: plan.wishId,
    wishAchieved,
    wishPoints,
    deadlineId: 'open',
    deadlineAchieved: wishAchieved,
    deadlinePoints,
    basePoints,
    earnedPoints,
    completedAtMinutes: plan.completedAtMinutes,
    endedAtMinutes: beforeNight.clockMinutes,
    rewardChoices: rewardChoicesForDay(beforeNight),
    finalNight,
  };
  const next = structuredClone(afterNight);
  next.dailyPoints += earnedPoints;
  next.dailyPlan = undefined;
  next.dailySettlement = settlement;
  // 日结信息由结算卡片与单条日志呈现，不再把点数写进持续反馈条，
  // 避免页面更新时让玩家误以为同一笔点数被反复发放。
  next.feedback = [];
  const log = createLog(
    next,
    '每日愿望结算',
    wishAchieved
      ? `愿望“${wish.name}”已经达成，本日获得 ${wish.rewardPoints} 愿望点。`
      : `愿望“${wish.name}”今天未能完成：没有获得奖励，也没有任何损失。`,
    wishAchieved ? 'good' : 'system',
  );
  log.dayLabel = settlement.dayLabel;
  next.logs = [...next.logs, log];
  return next;
}

export function claimDailyReward(state: GameState, rewardId: DailyRewardId): DailyResult {
  const settlement = state.dailySettlement;
  const reward = DAILY_REWARD_MAP[rewardId];
  if (!settlement) return { state, ok: false, message: '当前没有待领取的每日奖励。' };
  if (!settlement.rewardChoices.includes(rewardId) || !reward) return { state, ok: false, message: '这项奖励今天没有出现。' };
  if (state.dailyPoints < reward.cost) return { state, ok: false, message: `愿望点不足，还差 ${reward.cost - state.dailyPoints}。` };

  let next = structuredClone(state);
  const effects = {
    'quiet-rest': { stats: { stamina: 12, morale: 6 } },
    'water-cache': { inventory: { 'water-bottle': 1 }, shelter: { water: 2 } },
    'food-cache': { inventory: { crackers: 1, 'canned-beans': 1 } },
    'repair-kit': { inventory: { 'duct-tape': 1 }, shelter: { integrity: 10 } },
    'charge-pack': { inventory: { batteries: 1 }, shelter: { power: 4 } },
    'first-aid': { stats: { health: 12 } },
  } as const;
  next = applyEffect(next, effects[rewardId], `日结奖励 · ${reward.name}`);
  if (rewardId === 'first-aid' && next.injuries.length) next.injuries = next.injuries.slice(1);
  next.dailyPoints -= reward.cost;
  next.dailySettlement = undefined;
  const log = createLog(next, `领取日结奖励 · ${reward.name}`, `${reward.description} 愿望点 -${reward.cost}，剩余 ${next.dailyPoints}。`, 'good');
  log.dayLabel = settlement.dayLabel;
  next.logs = [...next.logs, log];
  return { state: ensureAssignedDailyWish(next), ok: true };
}

export function continueAfterMissedWish(state: GameState): DailyResult {
  const settlement = state.dailySettlement;
  if (!settlement) return { state, ok: false, message: '当前没有待确认的每日结算。' };
  if (settlement.wishAchieved) return { state, ok: false, message: '愿望已经完成，请领取一项奖励。' };
  const next = structuredClone(state);
  next.dailySettlement = undefined;
  next.feedback = [];
  return { state: ensureAssignedDailyWish(next), ok: true };
}
