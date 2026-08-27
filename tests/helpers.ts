import { chooseDailyDeadline, chooseDailyWish } from '../game/engine/daily.ts';
import type { DailyWishId, GameState } from '../game/types.ts';

export function activateDay<T extends GameState>(state: T, wishId?: DailyWishId): T {
  state.currentEventId = undefined;
  if (state.phase === 'ended' || state.dailyPlan || state.dailySettlement || state.flags.includes('evacuation-choice-pending')) return state;
  const selectedWish = wishId ?? (state.phase === 'prep' ? 'prep-income' : 'survival-care');
  const wish = chooseDailyWish(state, selectedWish);
  if (!wish.ok) throw new Error(wish.message);
  const deadline = chooseDailyDeadline(wish.state, 'open');
  if (!deadline.ok) throw new Error(deadline.message);
  return deadline.state as T;
}
