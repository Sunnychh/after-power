import { ENTERTAINMENT_MAP, type EntertainmentId } from '../data/entertainment.ts';
import { ITEM_MAP } from '../data/items.ts';
import type { GameState } from '../types.ts';
import { completeTimedAction, type EngineResult } from './day.ts';
import { dailyActionBlockedReason } from './daily.ts';
import { inventoryCount } from './inventory.ts';
import { applyEffect, createLog } from './state.ts';
import { timeDisabledReason } from './time.ts';

export function entertainmentFlag(state: Pick<GameState, 'survivalDay'>, id: EntertainmentId): string {
  return `entertainment:${id}:${state.survivalDay}`;
}

export function entertainmentDisabledReason(state: GameState, id: EntertainmentId): string | null {
  if (state.phase !== 'survival') return '封锁后才需要安排日常娱乐';
  const daily = dailyActionBlockedReason(state);
  if (daily) return daily;
  const activity = ENTERTAINMENT_MAP[id];
  const timed = timeDisabledReason(state, activity.minutes);
  if (timed) return timed;
  if (state.flags.includes(entertainmentFlag(state, id))) return '今天已经进行过这项娱乐；换一种活动吧';
  if (activity.requiredItem && inventoryCount(state.inventory, activity.requiredItem) < 1) return `缺少${ITEM_MAP[activity.requiredItem]?.name ?? activity.requiredItem}`;
  if (id === 'music' && state.shelter.power < 1 && inventoryCount(state.inventory, 'batteries') < 1) return '需要 1 点电力或电池组 ×1';
  return null;
}

export function performEntertainment(state: GameState, id: EntertainmentId): EngineResult {
  const disabled = entertainmentDisabledReason(state, id);
  if (disabled) return { state, ok: false, message: disabled };
  const activity = ENTERTAINMENT_MAP[id];
  let next = structuredClone(state);
  const energyText = id !== 'music' ? '' : next.shelter.power >= 1 ? '备用电力 -1。' : '电池组 -1。';
  next = applyEffect(next, {
    stats: { morale: activity.morale },
    ...(id === 'music'
      ? next.shelter.power >= 1 ? { shelter: { power: -1 } } : { inventory: { batteries: -1 } }
      : {}),
    addFlags: [entertainmentFlag(next, id)],
  }, activity.name);
  next.logs.push(createLog(next, activity.name, `${activity.description}${energyText} 精神 +${activity.morale}；同一娱乐今天不能重复获得收益。`, 'good'));
  return completeTimedAction(next, activity.minutes, `survival:entertainment:${id}`);
}
