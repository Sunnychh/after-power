import {
  DAILY_DEADLINE_MAP,
  DAILY_REWARD_MAP,
  DAILY_WISH_MAP,
  wishesForPhase,
} from '../data/daily.ts';
import type {
  DailyDeadlineId,
  DailyRewardId,
  DailySettlement,
  DailyWishId,
  GameState,
} from '../types.ts';
import { absoluteDay, applyEffect, createLog, dayLabel } from './state.ts';
import { formatClock } from './time.ts';

export type DailyResult = { state: GameState; ok: boolean; message?: string };

export function currentDayKey(state: GameState): string {
  return state.phase === 'prep' ? `prep:${state.prepDay}` : `survival:${state.survivalDay}`;
}

export function dailyActionBlockedReason(state: GameState): string | null {
  if (state.dailySettlement) return '先完成昨夜结算并领取一项奖励。';
  if (state.flags.includes('evacuation-choice-pending')) return '撤离通道已经开放，请先决定离城路线。';
  if (!state.dailyPlan) return '先为今天选择一个愿望。';
  if (!state.dailyPlan.deadlineId) return '先为今日愿望设置完成时限。';
  return null;
}

export function chooseDailyWish(state: GameState, wishId: DailyWishId): DailyResult {
  if (state.phase === 'ended') return { state, ok: false, message: '本轮已经结束。' };
  if (state.dailySettlement) return { state, ok: false, message: '先领取昨夜的日结奖励。' };
  if (state.flags.includes('evacuation-choice-pending')) return { state, ok: false, message: '先决定撤离路线。' };
  if (state.dailyPlan) return { state, ok: false, message: '今天的愿望已经写下，不能临时更换。' };
  const wish = DAILY_WISH_MAP[wishId];
  if (!wish || wish.phase !== state.phase) return { state, ok: false, message: '这个愿望不适合今天。' };
  const next = structuredClone(state);
  next.dailyPlan = { dayKey: currentDayKey(next), wishId, actions: [] };
  next.feedback = [];
  return { state: next, ok: true };
}

export function chooseDailyDeadline(state: GameState, deadlineId: DailyDeadlineId): DailyResult {
  if (!state.dailyPlan) return { state, ok: false, message: '先选择今天的愿望。' };
  if (state.dailyPlan.deadlineId) return { state, ok: false, message: '今天的完成时限已经确定。' };
  const deadline = DAILY_DEADLINE_MAP[deadlineId];
  if (!deadline) return { state, ok: false, message: '这个时限不存在。' };
  const next = structuredClone(state);
  next.dailyPlan!.deadlineId = deadlineId;
  const wish = DAILY_WISH_MAP[next.dailyPlan!.wishId];
  next.logs = [...next.logs, createLog(
    next,
    '写下今日愿望',
    `“${wish.name}。”${deadline.cutoffMinutes ? `你答应自己在 ${formatClock(deadline.cutoffMinutes)} 前完成。` : '今天不和时钟较劲，只求把事情做完。'}`,
    'system',
  )];
  next.feedback = [];
  return { state: next, ok: true };
}

function actionMatches(wishId: DailyWishId, actionId: string): boolean {
  return DAILY_WISH_MAP[wishId].matchingActions.some((candidate) => (
    candidate.endsWith(':') ? actionId.startsWith(candidate) : actionId === candidate
  ));
}

export function recordDailyAction(state: GameState, actionId: string): GameState {
  if (!state.dailyPlan?.deadlineId || state.dailyPlan.completedAtMinutes !== undefined) return state;
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
  if (!state.dailyPlan) return '尚未选择今日愿望';
  if (!state.dailyPlan.deadlineId) return '愿望已选，等待设置时限';
  if (state.dailyPlan.completedAtMinutes !== undefined) return `${formatClock(state.dailyPlan.completedAtMinutes)} 已达成`;
  return '进行中 · 完成后会立即记录时间';
}

function rewardChoicesForDay(state: GameState): DailyRewardId[] {
  const rotating: DailyRewardId[] = ['water-cache', 'food-cache', 'repair-kit', 'charge-pack', 'first-aid'];
  const index = (absoluteDay(state) + state.seed) % rotating.length;
  return ['quiet-rest', rotating[index], rotating[(index + 2) % rotating.length]];
}

export function createDailySettlement(beforeNight: GameState, afterNight: GameState, finalNight: boolean): GameState {
  const plan = beforeNight.dailyPlan;
  if (!plan?.deadlineId) return afterNight;
  const wish = DAILY_WISH_MAP[plan.wishId];
  const deadline = DAILY_DEADLINE_MAP[plan.deadlineId];
  const wishAchieved = plan.completedAtMinutes !== undefined;
  const deadlineAchieved = wishAchieved && (
    deadline.cutoffMinutes === undefined || plan.completedAtMinutes! <= deadline.cutoffMinutes
  );
  const basePoints = 1;
  const wishPoints = wishAchieved ? wish.rewardPoints : 0;
  const deadlinePoints = deadlineAchieved ? deadline.bonusPoints : 0;
  const earnedPoints = basePoints + wishPoints + deadlinePoints;
  const settlement: DailySettlement = {
    id: `${beforeNight.runId}-${plan.dayKey}`,
    dayKey: plan.dayKey,
    dayLabel: dayLabel(beforeNight),
    wishId: plan.wishId,
    wishAchieved,
    wishPoints,
    deadlineId: plan.deadlineId,
    deadlineAchieved,
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
  next.feedback.push({
    id: `${settlement.id}-points`,
    label: '愿望点',
    delta: earnedPoints,
    reason: '每日结算',
  });
  const deadlineText = deadline.bonusPoints === 0
    ? '本日未设置额外时限。'
    : deadlineAchieved
      ? `时限承诺达成，额外 +${deadline.bonusPoints}。`
      : `未在 ${formatClock(deadline.cutoffMinutes!)} 前完成，时限奖励为 0。`;
  const log = createLog(
    beforeNight,
    '每日愿望结算',
    `平安度过一天 +1。${wishAchieved ? `愿望“${wish.name}”达成 +${wish.rewardPoints}。` : `愿望“${wish.name}”未达成。`}${deadlineText}本日共获得 ${earnedPoints} 愿望点。`,
    wishAchieved ? 'good' : 'system',
  );
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
  next.feedback.push({ id: `${settlement.id}-spend`, label: '愿望点', delta: -reward.cost, reason: reward.name });
  next.dailySettlement = undefined;
  const log = createLog(next, `领取日结奖励 · ${reward.name}`, `${reward.description} 愿望点 -${reward.cost}，剩余 ${next.dailyPoints}。`, 'good');
  log.dayLabel = settlement.dayLabel;
  next.logs = [...next.logs, log];
  return { state: next, ok: true };
}

export function availableDailyWishes(state: GameState) {
  return wishesForPhase(state.phase);
}
