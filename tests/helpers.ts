import { ensureAssignedDailyWish } from '../game/engine/daily.ts';
import type { DailyWishId, GameState } from '../game/types.ts';

export function activateDay<T extends GameState>(state: T, wishId?: DailyWishId): T {
  state.currentEventId = undefined;
  if (state.phase === 'ended' || state.dailySettlement || state.flags.includes('evacuation-choice-pending')) return state;
  state.dailyPlan = undefined;
  return ensureAssignedDailyWish(state, wishId) as T;
}
