import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_MAP } from '../game/data/items.ts';
import { survivalPressure } from '../game/data/pressure.ts';
import { endDay, performSurvivalAction } from '../game/engine/actions.ts';
import { continueAfterMissedWish, dailyRewardCost, dailyRewardDescription } from '../game/engine/daily.ts';
import { addItem, inventoryCount } from '../game/engine/inventory.ts';
import { createInitialState } from '../game/engine/state.ts';
import { SURVIVAL_DAY_START } from '../game/engine/time.ts';
import { activateDay } from './helpers.ts';

function hardLateState(seed = 'hard-late-balance') {
  const state = activateDay(createInitialState(seed, [], 0, 'hard', true), 'survival-care');
  state.phase = 'survival';
  state.prepDay = 7;
  state.survivalDay = 8;
  state.clockMinutes = SURVIVAL_DAY_START;
  state.currentEventId = undefined;
  state.weather = '晴冷';
  state.stats = { satiety: 90, hydration: 90, health: 90, morale: 90, stamina: 60 };
  state.shelter.integrity = 100;
  state.shelter.reinforcement = 12;
  state.shelter.power = 30;
  state.broadcasts = 1;
  state.flags.push('horde-prepared');
  state.inventory = {};
  state.inventory = addItem(state.inventory, ITEM_MAP['canned-beans'], 12, 15);
  state.inventory = addItem(state.inventory, ITEM_MAP['water-bottle'], 12, 15);
  return state;
}

test('困难压力从第八夜开始升级，后两夜不能靠睡眠回满体力', () => {
  const early = survivalPressure('hard', 7);
  const siege = survivalPressure('hard', 8);
  const collapse = survivalPressure('hard', 11);
  const evacuation = survivalPressure('hard', 13);
  assert.ok(early.foodDrain < siege.foodDrain && siege.foodDrain < collapse.foodDrain && collapse.foodDrain < evacuation.foodDrain);
  assert.ok(early.waterDrain < siege.waterDrain && siege.waterDrain < collapse.waterDrain && collapse.waterDrain < evacuation.waterDrain);
  assert.ok(early.staminaRecovery > siege.staminaRecovery && siege.staminaRecovery > collapse.staminaRecovery && collapse.staminaRecovery > evacuation.staminaRecovery);
});

test('休息会随时间消耗食水，无材料临时修缮每天只能使用一次且不能循环造完整度', () => {
  let state = hardLateState('no-free-repair-loop');
  state.shelter.integrity = 50;
  state.stats.satiety = 100;
  state.stats.hydration = 100;
  state.stats.stamina = 50;
  const rested = performSurvivalAction(state, 'rest');
  assert.equal(rested.ok, true);
  assert.equal(rested.state.stats.satiety, 98);
  assert.equal(rested.state.stats.hydration, 98);
  state = rested.state;
  const repaired = performSurvivalAction(state, 'repair');
  assert.equal(repaired.ok, true);
  assert.equal(repaired.state.shelter.integrity, 52);
  assert.equal(repaired.state.stats.satiety, 96);
  assert.equal(repaired.state.stats.hydration, 96);
  const snapshot = structuredClone(repaired.state);
  const repeated = performSurvivalAction(repaired.state, 'repair');
  assert.equal(repeated.ok, false);
  assert.deepEqual(repeated.state, snapshot);
});

test('体力不足时不能继续透支执行修缮或加固', () => {
  const state = hardLateState('stamina-payment');
  state.stats.stamina = 15;
  assert.equal(performSurvivalAction(state, 'repair').ok, false);
  state.inventory = addItem(state.inventory, ITEM_MAP['wood-board'], 1, 15);
  state.stats.stamina = 9;
  assert.equal(performSurvivalAction(state, 'barricade').ok, false);
});

test('固定种子的困难第八至十四夜会真实消耗食水、电力、加固和完整度', () => {
  let state = hardLateState();
  const before = {
    food: inventoryCount(state.inventory, 'canned-beans'),
    water: inventoryCount(state.inventory, 'water-bottle'),
    power: state.shelter.power,
    reinforcement: state.shelter.reinforcement,
    integrity: state.shelter.integrity,
    morale: state.stats.morale,
  };

  for (let day = 8; day <= 14; day += 1) {
    state.survivalDay = day;
    state.clockMinutes = SURVIVAL_DAY_START;
    state.weather = '晴冷';
    state.currentEventId = undefined;
    state = activateDay(state, 'survival-care');
    const result = endDay(state);
    assert.equal(result.ok, true);
    state = result.state;
    if (day < 14) {
      assert.ok(state.dailySettlement);
      state = continueAfterMissedWish(state).state;
    }
  }

  assert.equal(state.phase, 'survival');
  assert.ok(state.dailySettlement?.finalNight);
  assert.ok(inventoryCount(state.inventory, 'canned-beans') < before.food);
  assert.ok(inventoryCount(state.inventory, 'water-bottle') < before.water);
  assert.ok(state.shelter.power < before.power);
  assert.ok(state.shelter.reinforcement < before.reinforcement);
  assert.ok(state.shelter.integrity <= before.integrity - 40);
  assert.ok(state.stats.morale < before.morale);
});

test('准备不足且不维护的困难路线会在连续围攻中明确失败', () => {
  let state = hardLateState('underprepared-hard');
  state.shelter.integrity = 45;
  state.shelter.reinforcement = 2;
  state.shelter.power = 0;
  state.inventory = addItem({}, ITEM_MAP['canned-beans'], 2, 15);
  state.inventory = addItem(state.inventory, ITEM_MAP['water-bottle'], 2, 15);
  for (let day = 8; day <= 14 && state.phase !== 'ended'; day += 1) {
    state.survivalDay = day;
    state.clockMinutes = SURVIVAL_DAY_START;
    state.weather = '晴冷';
    state.currentEventId = undefined;
    state = activateDay(state, 'survival-care');
    state = endDay(state).state;
    if (state.phase !== 'ended' && state.dailySettlement) state = continueAfterMissedWish(state).state;
  }
  assert.equal(state.phase, 'ended');
  assert.equal(state.outcome?.id, 'death');
  assert.match(state.outcome?.variantId ?? '', /death-siege/);
  assert.ok(state.survivalDay < 14);
});

test('困难愿望物资只能补贴一部分整局消耗，不能单独养活玩家', () => {
  const hard = createInitialState('reward-budget', [], 0, 'hard');
  assert.equal(dailyRewardCost(hard, 'food-cache'), 3);
  assert.equal(dailyRewardCost(hard, 'charge-pack'), 4);
  assert.match(dailyRewardDescription(hard, 'food-cache'), /压缩饼干 ×1/);
  const totalFoodDrain = Array.from({ length: 14 }, (_, index) => survivalPressure('hard', index + 1).foodDrain).reduce((sum, value) => sum + value, 0);
  const totalWaterDrain = Array.from({ length: 14 }, (_, index) => survivalPressure('hard', index + 1).waterDrain).reduce((sum, value) => sum + value, 0);
  const maximumPerfectWishPoints = 21; // 灾前 7 天 + 封锁 14 天，每天全部达成。
  const foodFromPoints = Math.floor(maximumPerfectWishPoints / dailyRewardCost(hard, 'food-cache')) * (ITEM_MAP.crackers.effects?.satiety ?? 0);
  const waterFromPoints = Math.floor(maximumPerfectWishPoints / dailyRewardCost(hard, 'water-cache')) * (ITEM_MAP['water-bottle'].effects?.hydration ?? 0);
  assert.ok(foodFromPoints <= totalFoodDrain * 0.5);
  assert.ok(waterFromPoints <= totalWaterDrain * 0.5);
});
