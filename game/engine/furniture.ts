import { ITEM_MAP } from '../data/items.ts';
import type { FurnitureId, GameState } from '../types.ts';
import { completeTimedAction, type EngineResult } from './day.ts';
import { dailyActionBlockedReason } from './daily.ts';
import { inventoryCount } from './inventory.ts';
import { absoluteDay, applyEffect, createLog } from './state.ts';
import { timeDisabledReason } from './time.ts';

export type FurnitureActionId = Exclude<FurnitureId, 'fridge'>;

export const FURNITURE_ACTION_MINUTES: Record<FurnitureActionId, number> = {
  'gas-stove': 60,
  microwave: 20,
  'electric-hotpot': 90,
};

export function furnitureActionDisabledReason(state: GameState, action: FurnitureActionId): string | null {
  if (state.phase !== 'survival') return '封锁后才需要启用厨房储备';
  const daily = dailyActionBlockedReason(state);
  if (daily) return daily;
  const timed = timeDisabledReason(state, FURNITURE_ACTION_MINUTES[action]);
  if (timed) return timed;
  if (!state.furniture[action].enabled || state.furniture[action].condition <= 0) return '家具当前不可用';
  if (action === 'gas-stove') {
    if (state.shelter.fuel < 2) return '燃料不足 2';
    if (inventoryCount(state.inventory, 'instant-noodles') < 1) return `缺少 ${ITEM_MAP['instant-noodles'].name}`;
    if (inventoryCount(state.inventory, 'water-bottle') < 1) return `缺少 ${ITEM_MAP['water-bottle'].name}`;
  }
  if (action === 'microwave') {
    if (state.shelter.power < 2) return '电力不足 2';
    if (inventoryCount(state.inventory, 'canned-beans') < 1) return `缺少 ${ITEM_MAP['canned-beans'].name}`;
  }
  if (action === 'electric-hotpot') {
    if (state.shelter.power < 3) return '电力不足 3';
    if (inventoryCount(state.inventory, 'instant-noodles') < 1) return `缺少 ${ITEM_MAP['instant-noodles'].name}`;
    if (inventoryCount(state.inventory, 'water-bottle') < 1) return `缺少 ${ITEM_MAP['water-bottle'].name}`;
  }
  return null;
}

export function performFurnitureAction(state: GameState, action: FurnitureActionId): EngineResult {
  const disabled = furnitureActionDisabledReason(state, action);
  if (disabled) return { state, ok: false, message: disabled };
  let next = structuredClone(state);
  next.feedback = [];
  let title = '';
  let body = '';
  if (action === 'gas-stove') {
    title = '燃气炉 · 煮一碗面';
    body = '蓝色火苗舔着锅底。汤滚起来时，屋里短暂有了寻常晚饭的味道。';
    next = applyEffect(next, {
      inventory: { 'instant-noodles': -1, 'water-bottle': -1 },
      shelter: { fuel: -2 },
      stats: { satiety: 38, hydration: 6, morale: 6, stamina: 4 },
    }, title);
  } else if (action === 'microwave') {
    title = '微波炉 · 加热罐头';
    body = '转盘只转了几圈，罐头就冒出热气。快，是此刻很昂贵的优点。';
    next = applyEffect(next, {
      inventory: { 'canned-beans': -1 },
      shelter: { power: -2 },
      stats: { satiety: 42, morale: 6, stamina: 3 },
    }, title);
  } else {
    title = '电火锅 · 煮一锅热汤';
    body = '方便面和最后几片调味蔬菜在锅里翻滚。你把每一口汤都喝了。';
    next = applyEffect(next, {
      inventory: { 'instant-noodles': -1, 'water-bottle': -1 },
      shelter: { power: -3 },
      stats: { satiety: 48, hydration: 12, morale: 10, stamina: 6 },
    }, title);
  }
  next.furniture[action].lastUsedDay = absoluteDay(next);
  next.logs = [...next.logs, createLog(next, title, body, 'good')];
  return completeTimedAction(next, FURNITURE_ACTION_MINUTES[action], `furniture:${action}`);
}
