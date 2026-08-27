import { DIFFICULTY_MAP } from '../data/difficulties.ts';
import type { GameState } from '../types.ts';

export const PREP_DAY_START = 8 * 60;
export const SURVIVAL_DAY_START = 7 * 60;

export function dayStartMinutes(state: Pick<GameState, 'phase'>): number {
  return state.phase === 'prep' ? PREP_DAY_START : SURVIVAL_DAY_START;
}

export function dayEndMinutes(state: Pick<GameState, 'phase' | 'difficulty'>): number {
  const config = DIFFICULTY_MAP[state.difficulty];
  return state.phase === 'prep' ? config.prepDayEnd : config.survivalDayEnd;
}

export function minutesRemaining(state: Pick<GameState, 'phase' | 'difficulty' | 'clockMinutes'>): number {
  if (state.phase === 'ended') return 0;
  return Math.max(0, dayEndMinutes(state) - state.clockMinutes);
}

export function formatClock(minutes: number): string {
  const safe = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}分钟`;
  if (!rest) return `${hours}小时`;
  return `${hours}小时${rest}分`;
}

export function timeDisabledReason(state: GameState, duration: number): string | null {
  if (state.currentEventId) return '先处理眼前的事件';
  if (state.phase === 'ended') return '本轮已经结束';
  const remaining = minutesRemaining(state);
  return remaining < duration ? `今天只剩 ${formatDuration(remaining)}` : null;
}

