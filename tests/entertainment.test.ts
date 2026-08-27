import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_MAP } from '../game/data/items.ts';
import { survivalPressure } from '../game/data/pressure.ts';
import { entertainmentDisabledReason, performEntertainment } from '../game/engine/entertainment.ts';
import { addItem, inventoryCount } from '../game/engine/inventory.ts';
import { createInitialState } from '../game/engine/state.ts';
import { SURVIVAL_DAY_START } from '../game/engine/time.ts';
import { activateDay } from './helpers.ts';

function entertainmentState() {
  const state = activateDay(createInitialState('entertainment', [], 0, 'hard'), 'survival-care');
  state.phase = 'survival';
  state.survivalDay = 3;
  state.clockMinutes = SURVIVAL_DAY_START;
  state.currentEventId = undefined;
  state.stats.morale = 40;
  state.shelter.power = 2;
  state.inventory = addItem({}, ITEM_MAP.paperback, 1, 8);
  state.inventory = addItem(state.inventory, ITEM_MAP['playing-cards'], 1, 8);
  state.inventory = addItem(state.inventory, ITEM_MAP['music-player'], 1, 8);
  state.inventory = addItem(state.inventory, ITEM_MAP.batteries, 1, 8);
  return state;
}

test('三档难度每天都有明确的精神自然消耗', () => {
  assert.ok(survivalPressure('easy', 1).moraleDrain > 0);
  assert.ok(survivalPressure('normal', 1).moraleDrain > survivalPressure('easy', 1).moraleDrain);
  assert.ok(survivalPressure('hard', 1).moraleDrain > survivalPressure('normal', 1).moraleDrain);
});

test('娱乐消耗时间并恢复精神，同一项目每天只能获得一次收益', () => {
  const state = entertainmentState();
  const result = performEntertainment(state, 'journal');
  assert.equal(result.ok, true);
  assert.equal(result.state.clockMinutes, SURVIVAL_DAY_START + 45);
  assert.equal(result.state.stats.morale, 44);
  assert.ok(result.state.flags.includes('entertainment:journal:3'));
  assert.equal(entertainmentDisabledReason(result.state, 'journal'), '今天已经进行过这项娱乐；换一种活动吧');
  assert.equal(performEntertainment(result.state, 'journal').ok, false);
});

test('小说与纸牌是可重复使用的收藏，音乐严格消耗电力或电池', () => {
  let state = entertainmentState();
  state = performEntertainment(state, 'read').state;
  assert.equal(inventoryCount(state.inventory, 'paperback'), 1);
  state = performEntertainment(state, 'cards').state;
  assert.equal(inventoryCount(state.inventory, 'playing-cards'), 1);

  const powerBefore = state.shelter.power;
  state = performEntertainment(state, 'music').state;
  assert.equal(state.shelter.power, powerBefore - 1);
  assert.equal(inventoryCount(state.inventory, 'batteries'), 1);

  const batteryState = entertainmentState();
  batteryState.shelter.power = 0;
  const batteryResult = performEntertainment(batteryState, 'music');
  assert.equal(batteryResult.ok, true);
  assert.equal(inventoryCount(batteryResult.state.inventory, 'batteries'), 0);
});
