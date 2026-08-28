import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_MAP } from '../game/data/items.ts';
import { useItem as consumeItem } from '../game/engine/actions.ts';
import { endDay } from '../game/engine/day.ts';
import { addItem } from '../game/engine/inventory.ts';
import { calculateFoodVariety, recoverFoodFatigue } from '../game/engine/nutrition.ts';
import { createInitialState } from '../game/engine/state.ts';
import { activateDay } from './helpers.ts';

function eatingState() {
  const state = activateDay(createInitialState('food-variety'), 'prep-income');
  state.currentEventId = undefined;
  state.stats.morale = 60;
  state.inventory = addItem({}, ITEM_MAP['canned-beans'], 10, 1);
  state.inventory = addItem(state.inventory, ITEM_MAP['fresh-apples'], 10, 1);
  state.inventory = addItem(state.inventory, ITEM_MAP['dish-vegetable-congee'], 3, 1);
  return state;
}

test('连续吃同一种冷食会累积单品熟悉度、全局厌倦并最终扣减精神', () => {
  let state = eatingState();
  state = consumeItem(state, 'canned-beans').state;
  const afterFirst = state.stats.morale;
  assert.equal(state.foodBoredom, 0);
  assert.ok(state.foodFatigue['canned-beans'] > 0);
  state = consumeItem(state, 'canned-beans').state;
  const secondBoredom = state.foodBoredom;
  assert.ok(secondBoredom > 0);
  state = consumeItem(state, 'canned-beans').state;
  state = consumeItem(state, 'canned-beans').state;
  assert.ok(state.foodBoredom > secondBoredom);
  assert.ok(state.stats.morale < afterFirst + 6, '高厌倦应抵消罐头本身累计的精神收益');
  assert.deepEqual(state.recentMeals, ['canned-beans', 'canned-beans', 'canned-beans', 'canned-beans']);
  assert.ok(state.logs.at(-1)?.body.includes('连续第 4 次'));
});

test('真正的新口味有限缓解厌倦，新料理比普通生食缓解更多', () => {
  let state = eatingState();
  state.foodBoredom = 55;
  state.foodFatigue = { 'canned-beans': 36 };
  state.recentMeals = ['canned-beans', 'canned-beans'];
  state = consumeItem(state, 'fresh-apples').state;
  const afterFresh = state.foodBoredom;
  assert.ok(afterFresh < 55);
  state = consumeItem(state, 'dish-vegetable-congee').state;
  assert.ok(state.foodBoredom < afterFresh);
  assert.ok(state.foodBoredom >= 35, '一道新菜不能清空长期厌倦');
  assert.ok(state.logs.at(-1)?.body.includes('新的热食'));
});

test('夜间自动配给与手动食用共用近期饮食和长期熟悉度', () => {
  let state = eatingState();
  state.phase = 'survival';
  state.survivalDay = 1;
  state.autoRations = true;
  state.stats.satiety = 5;
  state.inventory = addItem({}, ITEM_MAP['canned-beans'], 4, 8);
  state = endDay(state).state;
  assert.deepEqual(state.recentMeals, ['canned-beans', 'canned-beans']);
  const fatigue = state.foodFatigue['canned-beans'];

  state.dailySettlement = undefined;
  state.dailyPlan = undefined;
  state.currentEventId = undefined;
  state = activateDay(state, 'survival-care');
  state.stats.satiety = 5;
  state = endDay(state).state;
  assert.ok(state.foodBoredom > 0);
  assert.ok(state.foodFatigue['canned-beans'] > fatigue);
  assert.ok(state.logs.some((log) => log.body.includes('连续第')));
});

test('标准与艰难交替两种口粮都会累积长期厌倦，艰难更快', () => {
  let hard = eatingState();
  hard.difficulty = 'hard';
  for (let index = 0; index < 8; index += 1) hard = consumeItem(hard, index % 2 ? 'fresh-apples' : 'canned-beans').state;

  let normal = eatingState();
  for (let index = 0; index < 8; index += 1) normal = consumeItem(normal, index % 2 ? 'fresh-apples' : 'canned-beans').state;
  assert.ok(normal.foodBoredom > 0, '标准难度也不能用 A/B 交替清空厌倦');
  assert.ok(hard.foodBoredom > normal.foodBoredom);
  assert.ok(normal.foodFatigue['canned-beans'] > 0 && normal.foodFatigue['fresh-apples'] > 0);
});

test('预览与实际厌倦使用同一公式，熟悉度只在夜间缓慢恢复', () => {
  let state = eatingState();
  state = consumeItem(state, 'canned-beans').state;
  const preview = calculateFoodVariety(state, ITEM_MAP['canned-beans']);
  const before = state.foodBoredom;
  state = consumeItem(state, 'canned-beans').state;
  assert.equal(state.foodBoredom - before, preview.boredomDelta);
  const fatigueBefore = state.foodFatigue['canned-beans'];
  const recovered = recoverFoodFatigue(state);
  assert.ok(recovered.state.foodFatigue['canned-beans'] < fatigueBefore);
  assert.ok(recovered.state.foodFatigue['canned-beans'] > 0, '一夜不能清空单品长期熟悉度');
});

test('失败料理首次食用也会增加厌倦，不享受新口味减免', () => {
  const state = eatingState();
  state.foodBoredom = 50;
  const forecast = calculateFoodVariety(state, ITEM_MAP['scorched-meal']);
  assert.ok(forecast.boredomDelta >= 6);
  assert.ok(forecast.moralePenalty > 0);
  assert.match(forecast.message, /失败口感|加重/);
});

test('厌倦封顶后继续重复进食仍会产生即时精神压力', () => {
  const state = eatingState();
  state.foodBoredom = 100;
  state.eatenFoodIds = ['canned-beans'];
  state.foodFatigue = { 'canned-beans': 80 };
  state.foodFamilyFatigue = { '豆类': 70 };
  state.recentMeals = Array(6).fill('canned-beans');
  const forecast = calculateFoodVariety(state, ITEM_MAP['canned-beans']);
  assert.equal(forecast.boredomDelta, 0);
  assert.ok(forecast.moralePenalty >= 6);
});

test('新单品会继承同类口感疲劳，数值与文案不会相反', () => {
  const state = eatingState();
  state.foodBoredom = 50;
  state.eatenFoodIds = ['tomato-can'];
  state.foodFatigue = { 'tomato-can': 48 };
  state.foodFamilyFatigue = { '果蔬': 60, '面食': 60 };
  state.recentMeals = Array(4).fill('tomato-can');
  const apple = calculateFoodVariety(state, ITEM_MAP['fresh-apples']);
  assert.ok(apple.boredomDelta > 0);
  assert.match(apple.message, /同类口感|疲倦/);
  assert.doesNotMatch(apple.message, /略有缓解/);

  const noodles = calculateFoodVariety(state, ITEM_MAP['dish-mushroom-noodles']);
  assert.ok(noodles.boredomDelta >= 0, '新汤面不能清空已累积的面食疲劳');
});

test('吃过的食物即使熟悉度归零也不会再次获得首次减免', () => {
  const state = eatingState();
  state.foodBoredom = 40;
  state.eatenFoodIds = ['canned-beans'];
  state.foodFatigue = {};
  state.foodFamilyFatigue = {};
  state.recentMeals = [];
  const forecast = calculateFoodVariety(state, ITEM_MAP['canned-beans']);
  assert.ok(forecast.boredomDelta > 0);
  assert.doesNotMatch(forecast.message, /第一次/);
});

test('灾前与封锁后都会执行每夜熟悉度衰减', () => {
  const state = eatingState();
  state.foodBoredom = 20;
  state.foodFatigue = { 'canned-beans': 30 };
  state.foodFamilyFatigue = { '豆类': 24 };
  const settled = endDay(state).state;
  assert.ok(settled.foodBoredom < 20);
  assert.ok(settled.foodFatigue['canned-beans'] < 30);
  assert.ok(settled.foodFamilyFatigue['豆类'] < 24);
});
