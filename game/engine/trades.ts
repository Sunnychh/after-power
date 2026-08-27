import { ITEM_MAP } from '../data/items.ts';
import { TRADE_OFFER_MAP, TRADE_OFFERS, type TradeOfferDefinition } from '../data/trades.ts';
import { NPC_MAP } from '../data/world.ts';
import type { GameState } from '../types.ts';
import { completeTimedAction, type EngineResult } from './day.ts';
import { dailyActionBlockedReason } from './daily.ts';
import { inventoryCount, inventoryWeight } from './inventory.ts';
import { isNpcUnlocked } from './npcs.ts';
import { normalizeSeed, randomInt } from './rng.ts';
import { applyEffect, createLog } from './state.ts';
import { timeDisabledReason } from './time.ts';

export const TRADE_MINUTES = 60;

export function tradeFlag(state: GameState, offerId: string): string {
  return `trade:${state.survivalDay}:${offerId}`;
}

export function tradesUsedToday(state: GameState): number {
  const prefix = `trade:${state.survivalDay}:`;
  return state.flags.filter((flag) => flag.startsWith(prefix)).length;
}

export function dailyTradeOffers(state: GameState): TradeOfferDefinition[] {
  if (state.phase !== 'survival') return [];
  const pool = TRADE_OFFERS.filter((offer) => isNpcUnlocked(state, offer.npcId));
  const selected: TradeOfferDefinition[] = [];
  let seed = normalizeSeed(`${state.seed}:trade-board:${state.survivalDay}`);
  const remaining = [...pool];
  const limit = pool.length <= 3 ? Math.min(2, pool.length) : 3;
  while (remaining.length && selected.length < limit) {
    const roll = randomInt(seed, 0, remaining.length - 1);
    seed = roll.state;
    selected.push(remaining.splice(roll.value, 1)[0]);
  }
  return selected;
}

export function tradeItemsText(items: Record<string, number>): string {
  return Object.entries(items).map(([itemId, quantity]) => `${ITEM_MAP[itemId]?.name ?? itemId} ×${quantity}`).join('、');
}

export function tradeOfferDisabledReason(state: GameState, offerId: string): string | null {
  const dailyReason = dailyActionBlockedReason(state);
  if (dailyReason) return dailyReason;
  if (state.phase !== 'survival') return '封锁前没有幸存者交易板';
  const offer = TRADE_OFFER_MAP[offerId];
  if (!offer || !dailyTradeOffers(state).some((candidate) => candidate.id === offerId)) return '这项报价今天没有出现';
  if (state.flags.includes(tradeFlag(state, offerId))) return '今天已经完成过这笔交易';
  if (state.difficulty !== 'easy' && tradesUsedToday(state) >= 1) return '标准与艰难难度每天只能完成一笔交易';
  const timeReason = timeDisabledReason(state, TRADE_MINUTES);
  if (timeReason) return timeReason;
  for (const [itemId, quantity] of Object.entries(offer.give)) {
    if (inventoryCount(state.inventory, itemId) < quantity) return `缺少${ITEM_MAP[itemId]?.name ?? itemId} ×${quantity}`;
  }
  const receivedWeight = Object.entries(offer.receive).reduce((sum, [itemId, quantity]) => sum + (ITEM_MAP[itemId]?.weight ?? 0) * quantity, 0);
  const givenWeight = Object.entries(offer.give).reduce((sum, [itemId, quantity]) => sum + (ITEM_MAP[itemId]?.weight ?? 0) * quantity, 0);
  if (inventoryWeight(state.inventory, ITEM_MAP) - givenWeight + receivedWeight > state.carryCapacity + 0.0001) return '避难所储物空间不足';
  return null;
}

export function executeTrade(state: GameState, offerId: string): EngineResult {
  const reason = tradeOfferDisabledReason(state, offerId);
  if (reason) return { state, ok: false, message: reason };
  const offer = TRADE_OFFER_MAP[offerId];
  const next = applyEffect(state, {
    inventory: {
      ...Object.fromEntries(Object.entries(offer.give).map(([itemId, quantity]) => [itemId, -quantity])),
      ...offer.receive,
    },
    relationships: { [offer.npcId]: 3 },
    addFlags: [tradeFlag(state, offer.id)],
  }, `交易 · ${NPC_MAP[offer.npcId].name}`);
  next.logs.push(createLog(next, `交易 · ${NPC_MAP[offer.npcId].name}`, `${offer.result} 付出：${tradeItemsText(offer.give)}；获得：${tradeItemsText(offer.receive)}。`, 'good'));
  return completeTimedAction(next, TRADE_MINUTES, `survival:trade:${offer.id}`);
}
