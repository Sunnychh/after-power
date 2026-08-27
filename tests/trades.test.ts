import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_MAP } from '../game/data/items.ts';
import { addItem, inventoryCount } from '../game/engine/inventory.ts';
import { createInitialState } from '../game/engine/state.ts';
import { dailyTradeOffers, executeTrade, tradeFlag, tradeOfferDisabledReason } from '../game/engine/trades.ts';
import { SURVIVAL_DAY_START } from '../game/engine/time.ts';
import { activateDay } from './helpers.ts';

function tradeState(seed = 'daily-trades', broadcasts = 4) {
  const state = createInitialState(seed);
  state.phase = 'survival';
  state.prepDay = 7;
  state.survivalDay = 4;
  state.clockMinutes = SURVIVAL_DAY_START;
  state.currentEventId = undefined;
  state.broadcasts = broadcasts;
  return activateDay(state, 'survival-care');
}

test('每日报价由种子和日期稳定生成，刷新不重抽而跨日会变化', () => {
  const state = tradeState('stable-trade-board');
  const today = dailyTradeOffers(state).map((offer) => offer.id);
  assert.deepEqual(dailyTradeOffers(structuredClone(state)).map((offer) => offer.id), today);
  const boards = new Set<string>();
  for (let day = 1; day <= 8; day += 1) {
    state.survivalDay = day;
    boards.add(dailyTradeOffers(state).map((offer) => offer.id).join(','));
  }
  assert.ok(boards.size >= 5);
});

test('报价只来自已通过广播联络的人物', () => {
  assert.equal(dailyTradeOffers(tradeState('no-contact', 0)).length, 0);
  const chenOnly = dailyTradeOffers(tradeState('one-contact', 1));
  assert.equal(chenOnly.length, 2);
  assert.ok(chenOnly.every((offer) => offer.npcId === 'chen-meng'));
  const all = dailyTradeOffers(tradeState('all-contacts', 4));
  assert.equal(all.length, 3);
  assert.ok(new Set(all.map((offer) => offer.npcId)).size >= 1);
});

test('成交严格扣除付出、增加所得、推进时间且同日报价只能使用一次', () => {
  const state = tradeState('execute-trade', 4);
  const offer = dailyTradeOffers(state)[0];
  for (const [itemId, quantity] of Object.entries(offer.give)) state.inventory = addItem(state.inventory, ITEM_MAP[itemId], quantity, 8);
  const beforeGive = Object.fromEntries(Object.keys(offer.give).map((itemId) => [itemId, inventoryCount(state.inventory, itemId)]));
  const beforeReceive = Object.fromEntries(Object.keys(offer.receive).map((itemId) => [itemId, inventoryCount(state.inventory, itemId)]));
  const result = executeTrade(state, offer.id);
  assert.equal(result.ok, true);
  assert.equal(result.state.clockMinutes, SURVIVAL_DAY_START + 60);
  for (const [itemId, quantity] of Object.entries(offer.give)) assert.equal(inventoryCount(result.state.inventory, itemId), beforeGive[itemId] - quantity);
  for (const [itemId, quantity] of Object.entries(offer.receive)) assert.equal(inventoryCount(result.state.inventory, itemId), beforeReceive[itemId] + quantity);
  assert.ok(result.state.flags.includes(tradeFlag(state, offer.id)));
  assert.equal(executeTrade(result.state, offer.id).ok, false);
});

test('缺少交换物或报价未刷新时不会改变任何状态', () => {
  const state = tradeState('trade-unavailable', 1);
  const offer = dailyTradeOffers(state)[0];
  const reason = tradeOfferDisabledReason(state, offer.id);
  assert.ok(reason?.startsWith('缺少'));
  const snapshot = structuredClone(state);
  const failed = executeTrade(state, offer.id);
  assert.equal(failed.ok, false);
  assert.deepEqual(failed.state, snapshot);
  assert.equal(executeTrade(state, 'not-on-board').ok, false);
});
