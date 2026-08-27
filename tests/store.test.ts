import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_MAP } from '../game/data/items.ts';
import { purchaseItem, visitStore } from '../game/engine/actions.ts';
import { inventoryCount } from '../game/engine/inventory.ts';
import { createInitialState } from '../game/engine/state.ts';
import { initialStoreStock, shoppingCarryRemaining, storeStock } from '../game/engine/store.ts';
import { activateDay } from './helpers.ts';

function prepState(seed: string, difficulty: 'easy' | 'normal' | 'hard' = 'normal') {
  const state = createInitialState(seed, [], 0, difficulty);
  state.currentEventId = undefined;
  return activateDay(state, 'prep-income');
}

test('商店库存从第一天开始逐日单调减少', () => {
  const state = prepState('declining-stock');
  const item = ITEM_MAP['water-bottle'];
  const daily = Array.from({ length: 7 }, (_, index) => {
    state.prepDay = index + 1;
    return initialStoreStock(state, item);
  });
  assert.ok(daily[0] > daily[1]);
  assert.ok(daily.every((value, index) => index === 0 || value <= daily[index - 1]));
  assert.equal(daily[6], 0);
});

test('购买会扣除现金和当日库存，售罄后不能继续购买', () => {
  let state = prepState('sell-out', 'easy');
  state.money = 10_000;
  state.carryCapacity = 200;
  state = visitStore(state, 'market').state;
  state.shoppingTrip!.capacity = 200;
  const item = ITEM_MAP['instant-coffee'];
  const opening = storeStock(state, item).remaining;
  const moneyBefore = state.money;
  const ownedBefore = inventoryCount(state.inventory, item.id);
  for (let count = 0; count < opening; count += 1) {
    const bought = purchaseItem(state, item.id);
    assert.equal(bought.ok, true);
    state = bought.state;
  }
  assert.equal(storeStock(state, item).remaining, 0);
  assert.equal(state.money, moneyBefore - opening * item.price);
  assert.equal(inventoryCount(state.inventory, item.id), ownedBefore + opening);
  assert.equal(purchaseItem(state, item.id).ok, false);
});

test('每次采购受独立随身包容量限制', () => {
  let state = prepState('trip-capacity', 'hard');
  state.money = 10_000;
  state.carryCapacity = 200;
  state = visitStore(state, 'fuel').state;
  const item = ITEM_MAP['fuel-can'];
  assert.equal(state.shoppingTrip?.capacity, 9);
  assert.equal(purchaseItem(state, item.id).ok, true);
  state = purchaseItem(state, item.id).state;
  assert.equal(purchaseItem(state, item.id).ok, true);
  state = purchaseItem(state, item.id).state;
  assert.ok(shoppingCarryRemaining(state) < item.weight);
  const blocked = purchaseItem(state, item.id);
  assert.equal(blocked.ok, false);
  assert.match(blocked.message ?? '', /随身包/);
});

test('第七天停止正常零售，冒险结果包含受伤与免费带回物资', () => {
  let injuries = 0;
  let successes = 0;
  for (let index = 0; index < 120; index += 1) {
    const state = prepState(`last-day-${index}`, 'normal');
    state.prepDay = 7;
    const moneyBefore = state.money;
    const healthBefore = state.stats.health;
    const inventoryBefore = Object.values(state.inventory).flat().reduce((sum, batch) => sum + batch.quantity, 0);
    const result = visitStore(state, 'market');
    const inventoryAfter = Object.values(result.state.inventory).flat().reduce((sum, batch) => sum + batch.quantity, 0);
    assert.equal(result.ok, true);
    assert.equal(result.state.money, moneyBefore);
    assert.equal(result.state.shoppingTrip, undefined);
    if (result.state.stats.health < healthBefore) injuries += 1;
    if (inventoryAfter > inventoryBefore) successes += 1;
  }
  assert.ok(injuries > 0, '应有种子触发受伤结果');
  assert.ok(successes > 0, '应有种子触发免费带回物资');
});

test('同一家店每天只能进场一次，最后一天整日也只能冒险采购一次', () => {
  let ordinary = prepState('one-store-visit', 'hard');
  ordinary = visitStore(ordinary, 'market').state;
  ordinary.shoppingTrip = undefined;
  const repeated = visitStore(ordinary, 'market');
  assert.equal(repeated.ok, false);
  assert.match(repeated.message ?? '', /今天已经去过/);

  let finalDay = prepState('one-risky-trip', 'hard');
  finalDay.prepDay = 7;
  finalDay = visitStore(finalDay, 'market').state;
  const second = visitStore(finalDay, 'hardware');
  assert.equal(second.ok, false);
  assert.match(second.message ?? '', /只能冒险采购一次/);
});
