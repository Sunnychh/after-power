import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_MAP } from '../game/data/items.ts';
import { useItem } from '../game/engine/actions.ts';
import { endDay } from '../game/engine/day.ts';
import { addItem } from '../game/engine/inventory.ts';
import { createInitialState } from '../game/engine/state.ts';
import { activateDay } from './helpers.ts';

function eatingState() {
  const state = activateDay(createInitialState('food-variety'), 'prep-income');
  state.currentEventId = undefined;
  state.stats.morale = 60;
  state.inventory = addItem({}, ITEM_MAP['canned-beans'], 3, 1);
  state.inventory = addItem(state.inventory, ITEM_MAP['fresh-apples'], 1, 1);
  state.inventory = addItem(state.inventory, ITEM_MAP['dish-vegetable-congee'], 1, 1);
  return state;
}

test('连续吃同一种冷食会累积厌倦并扣减精神', () => {
  let state = eatingState();
  state = useItem(state, 'canned-beans').state;
  const afterFirst = state.stats.morale;
  assert.equal(state.foodBoredom, 0);
  state = useItem(state, 'canned-beans').state;
  assert.equal(state.foodBoredom, 15);
  assert.ok(state.stats.morale < afterFirst + 2, '重复惩罚应抵消罐头本身的精神收益');
  state = useItem(state, 'canned-beans').state;
  assert.equal(state.foodBoredom, 35);
  assert.deepEqual(state.recentMeals, ['canned-beans', 'canned-beans', 'canned-beans']);
  assert.ok(state.logs.at(-1)?.body.includes('连续第 3 次'));
});

test('更换口味会降低厌倦，不同料理降低得更多', () => {
  let state = eatingState();
  state.foodBoredom = 55;
  state.recentMeals = ['canned-beans', 'canned-beans'];
  state = useItem(state, 'fresh-apples').state;
  assert.equal(state.foodBoredom, 47);
  state = useItem(state, 'dish-vegetable-congee').state;
  assert.equal(state.foodBoredom, 23);
  assert.ok(state.logs.at(-1)?.body.includes('不同的热食'));
});

test('夜间自动配给与手动食用共用近期饮食记录', () => {
  let state = eatingState();
  state.phase = 'survival';
  state.survivalDay = 1;
  state.autoRations = true;
  state.stats.satiety = 5;
  state.inventory = addItem({}, ITEM_MAP['canned-beans'], 2, 8);
  state = endDay(state).state;
  assert.deepEqual(state.recentMeals, ['canned-beans']);

  state.dailySettlement = undefined;
  state.dailyPlan = undefined;
  state.currentEventId = undefined;
  state = activateDay(state, 'survival-care');
  state.stats.satiety = 5;
  state = endDay(state).state;
  assert.equal(state.foodBoredom, 15);
  assert.ok(state.logs.some((log) => log.body.includes('连续第 2 次吃豆类罐头')));
});

test('艰难模式交替两种口粮仍会识别最近四餐的重复', () => {
  let hard = eatingState();
  hard.difficulty = 'hard';
  hard = useItem(hard, 'canned-beans').state;
  hard = useItem(hard, 'fresh-apples').state;
  hard = useItem(hard, 'canned-beans').state;
  assert.equal(hard.foodBoredom, 8);
  assert.ok(hard.logs.at(-1)?.body.includes('最近四餐'));

  let normal = eatingState();
  normal = useItem(normal, 'canned-beans').state;
  normal = useItem(normal, 'fresh-apples').state;
  normal = useItem(normal, 'canned-beans').state;
  assert.equal(normal.foodBoredom, 0, '标准难度允许用两种口粮交替缓解单调');
});
