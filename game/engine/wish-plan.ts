import { DAILY_WISH_MAP, wishesForPhase } from '../data/daily.ts';
import { commissionsForPhase } from '../data/commissions.ts';
import type { DailyCommissionProgress, DailyPlan, DailyWishId, GameState } from '../types.ts';
import { normalizeSeed } from './rng.ts';
import { minutesRemaining } from './time.ts';

export function wishDayKey(state: Pick<GameState, 'phase' | 'prepDay' | 'survivalDay'>): string {
  return state.phase === 'prep' ? `prep:${state.prepDay}` : `survival:${state.survivalDay}`;
}

function canCompleteWish(state: GameState, wishId: DailyWishId): boolean {
  const remaining = minutesRemaining(state);
  switch (wishId) {
    case 'prep-income':
      return remaining >= 240 && !state.flags.includes(`worked:${state.prepDay}`);
    case 'prep-home':
      return remaining >= 180 && state.money >= 70;
    case 'prep-contact':
      return remaining >= 120;
    case 'survival-explore':
      return remaining >= 240;
    case 'survival-care':
    case 'survival-secure':
      return remaining >= 120;
  }
}

export function assignedWishId(state: GameState): DailyWishId {
  const available = wishesForPhase(state.phase).filter((wish) => canCompleteWish(state, wish.id));
  const fallback = wishesForPhase(state.phase);
  const candidates = available.length ? available : fallback;
  const ordinal = state.phase === 'prep' ? state.prepDay : 7 + state.survivalDay;
  return candidates[(state.seed + ordinal) % candidates.length].id;
}

export function createAssignedDailyPlan(state: GameState, forcedWishId?: DailyWishId): DailyPlan {
  const selected = forcedWishId && DAILY_WISH_MAP[forcedWishId]?.phase === state.phase
    ? forcedWishId
    : assignedWishId(state);
  const commissionPool = commissionsForPhase(state.phase);
  const count = Math.min(state.difficulty === 'hard' ? 1 : 2, commissionPool.length);
  const dayKey = wishDayKey(state);
  const start = commissionPool.length ? normalizeSeed(`${state.seed}:${dayKey}:commissions`) % commissionPool.length : 0;
  const commissions: DailyCommissionProgress[] = [];
  for (let offset = 0; offset < commissionPool.length && commissions.length < count; offset += 1) {
    const candidate = commissionPool[(start + offset) % commissionPool.length];
    const duplicatesWish = candidate.matchingActions.some((action) => DAILY_WISH_MAP[selected].matchingActions.some((wishAction) => action === wishAction));
    if (!duplicatesWish || commissionPool.length <= count) commissions.push({ id: candidate.id });
  }
  return {
    dayKey,
    wishId: selected,
    // 保留 open 字段以兼容 v3 存档；新版规则不再要求玩家设置时限。
    deadlineId: 'open',
    actions: [],
    commissions,
  };
}
