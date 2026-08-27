import {
  DAILY_REWARD_MAP,
  DAILY_WISH_MAP,
} from '../data/daily.ts';
import { DAILY_COMMISSION_MAP } from '../data/commissions.ts';
import { wishPointsForDifficulty } from '../data/pressure.ts';
import type {
  DailyRewardId,
  DailySettlement,
  DailyWishId,
  EventEffect,
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

function matchesAny(patterns: string[], actionId: string): boolean {
  return patterns.some((candidate) => candidate.endsWith(':') ? actionId.startsWith(candidate) : candidate === actionId);
}

export function recordDailyAction(state: GameState, actionId: string): GameState {
  if (!state.dailyPlan) return state;
  const next = structuredClone(state);
  next.dailyPlan!.actions.push(actionId);
  if (next.dailyPlan!.completedAtMinutes === undefined && actionMatches(next.dailyPlan!.wishId, actionId)) {
    next.dailyPlan!.completedAtMinutes = next.clockMinutes;
    const wish = DAILY_WISH_MAP[next.dailyPlan!.wishId];
    next.logs = [...next.logs, createLog(
      next,
      '今日愿望已达成',
      `“${wish.name}”在 ${formatClock(next.clockMinutes)} 完成。愿望点会在今晚结算。`,
      'good',
    )];
  }
  for (const commission of next.dailyPlan!.commissions ?? []) {
    if (commission.completedAtMinutes !== undefined) continue;
    const definition = DAILY_COMMISSION_MAP[commission.id];
    if (!definition || !matchesAny(definition.matchingActions, actionId)) continue;
    commission.completedAtMinutes = next.clockMinutes;
    commission.pointsAwarded = 1;
    next.dailyPoints += 1;
    next.feedback.push({ id: `${next.runId}-commission-${next.dailyPlan!.dayKey}-${commission.id}`, label: '愿望点', delta: 1, reason: definition.name });
    next.logs.push(createLog(next, `每日委托完成 · ${definition.name}`, `你在 ${formatClock(next.clockMinutes)} 完成了额外委托，愿望点立即 +1。`, 'good'));
  }
  return next;
}

export function dailyWishProgress(state: GameState): string {
  if (!state.dailyPlan) return '今日愿望尚未生成';
  if (state.dailyPlan.completedAtMinutes !== undefined) return `${formatClock(state.dailyPlan.completedAtMinutes)} 已达成`;
  return '进行中 · 今天结束前完成即可';
}

export function dailyWishRewardPoints(state: Pick<GameState, 'difficulty'>): number {
  return wishPointsForDifficulty(state.difficulty);
}

export function dailyRewardDescription(state: Pick<GameState, 'difficulty'>, rewardId: DailyRewardId): string {
  const easy = state.difficulty === 'easy';
  if (rewardId === 'quiet-rest') return easy ? '体力 +12，精神 +6。' : state.difficulty === 'hard' ? '体力 +6，精神 +2。' : '体力 +8，精神 +4。';
  if (rewardId === 'water-cache') return easy ? '瓶装水 ×1，储水 +2。' : '瓶装水 ×1。';
  if (rewardId === 'food-cache') return easy ? '豆类罐头 ×1、压缩饼干 ×1。' : state.difficulty === 'hard' ? '压缩饼干 ×1。' : '豆类罐头 ×1。';
  if (rewardId === 'repair-kit') return easy ? '完整度 +8，强力胶带 ×1。' : '强力胶带 ×1。';
  if (rewardId === 'charge-pack') return easy ? '备用电力 +4，电池组 ×1。' : '备用电力 +3。';
  return easy ? '健康 +12，并处理一项持续伤病。' : state.difficulty === 'hard' ? '健康 +7，并处理一项持续伤病。' : '健康 +9，并处理一项持续伤病。';
}

export function dailyRewardCost(state: Pick<GameState, 'difficulty'>, rewardId: DailyRewardId): number {
  const base = DAILY_REWARD_MAP[rewardId].cost;
  if (state.difficulty === 'easy' || rewardId === 'quiet-rest') return base;
  return base + 1;
}

function dailyRewardEffect(state: Pick<GameState, 'difficulty'>, rewardId: DailyRewardId): EventEffect {
  const easy = state.difficulty === 'easy';
  if (rewardId === 'quiet-rest') return { stats: easy ? { stamina: 12, morale: 6 } : state.difficulty === 'hard' ? { stamina: 6, morale: 2 } : { stamina: 8, morale: 4 } };
  if (rewardId === 'water-cache') return easy ? { inventory: { 'water-bottle': 1 }, shelter: { water: 2 } } : { inventory: { 'water-bottle': 1 } };
  if (rewardId === 'food-cache') return easy ? { inventory: { crackers: 1, 'canned-beans': 1 } } : state.difficulty === 'hard' ? { inventory: { crackers: 1 } } : { inventory: { 'canned-beans': 1 } };
  if (rewardId === 'repair-kit') return easy ? { inventory: { 'duct-tape': 1 }, shelter: { integrity: 8 } } : { inventory: { 'duct-tape': 1 } };
  if (rewardId === 'charge-pack') return easy ? { inventory: { batteries: 1 }, shelter: { power: 4 } } : { shelter: { power: 3 } };
  return { stats: { health: easy ? 12 : state.difficulty === 'hard' ? 7 : 9 } };
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
  const wishPoints = wishAchieved ? dailyWishRewardPoints(beforeNight) : 0;
  const commissionPoints = (plan.commissions ?? []).reduce((sum, commission) => sum + (commission.pointsAwarded ?? 0), 0);
  const deadlinePoints = 0;
  const earnedPoints = wishPoints + commissionPoints;
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
    commissionPoints,
    completedAtMinutes: plan.completedAtMinutes,
    endedAtMinutes: beforeNight.clockMinutes,
    rewardChoices: rewardChoicesForDay(beforeNight),
    finalNight,
  };
  const next = structuredClone(afterNight);
  next.dailyPoints += wishPoints;
  next.dailyPlan = undefined;
  next.dailySettlement = settlement;
  // 日结信息由结算卡片与单条日志呈现，不再把点数写进持续反馈条，
  // 避免页面更新时让玩家误以为同一笔点数被反复发放。
  next.feedback = [];
  const log = createLog(
    next,
    '每日愿望结算',
    wishAchieved
      ? `愿望“${wish.name}”已经达成，日结获得 ${wishPoints} 点；每日委托另已即时获得 ${commissionPoints} 点。`
      : `愿望“${wish.name}”今天未能完成：没有获得奖励，也没有任何损失。每日委托已即时获得 ${commissionPoints} 点。`,
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
  const cost = dailyRewardCost(state, rewardId);
  if (state.dailyPoints < cost) return { state, ok: false, message: `愿望点不足，还差 ${cost - state.dailyPoints}。` };

  let next = structuredClone(state);
  next = applyEffect(next, dailyRewardEffect(next, rewardId), `日结奖励 · ${reward.name}`);
  if (rewardId === 'first-aid' && next.injuries.length) next.injuries = next.injuries.slice(1);
  next.dailyPoints -= cost;
  next.dailySettlement = undefined;
  const log = createLog(next, `领取日结奖励 · ${reward.name}`, `${dailyRewardDescription(next, rewardId)}愿望点 -${cost}，剩余 ${next.dailyPoints}。`, 'good');
  log.dayLabel = settlement.dayLabel;
  next.logs = [...next.logs, log];
  return { state: ensureAssignedDailyWish(next), ok: true };
}

export function bankDailyPoints(state: GameState): DailyResult {
  const settlement = state.dailySettlement;
  if (!settlement || !settlement.wishAchieved) return { state, ok: false, message: '当前没有可保留的愿望点结算。' };
  const next = structuredClone(state);
  next.dailySettlement = undefined;
  next.feedback = [];
  const log = createLog(next, '保留愿望点', `没有领取即时物资，当前 ${next.dailyPoints} 点全部留到后续日结。`, 'system');
  log.dayLabel = settlement.dayLabel;
  next.logs.push(log);
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
