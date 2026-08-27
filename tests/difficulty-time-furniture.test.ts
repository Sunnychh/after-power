import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_MAP, ITEMS } from '../game/data/items.ts';
import { performPrepAction } from '../game/engine/actions.ts';
import { claimDailyReward } from '../game/engine/daily.ts';
import { endDay, extendColdStorage } from '../game/engine/day.ts';
import { furnitureActionDisabledReason, performFurnitureAction } from '../game/engine/furniture.ts';
import { addItem, inventoryCount } from '../game/engine/inventory.ts';
import { createInitialState, rollDanger } from '../game/engine/state.ts';
import { chooseEvacuation } from '../game/engine/outcomes.ts';
import { dayEndMinutes, PREP_DAY_START, SURVIVAL_DAY_START } from '../game/engine/time.ts';
import { activateDay } from './helpers.ts';

function clearEvent<T extends ReturnType<typeof createInitialState>>(state: T): T {
  state.currentEventId = undefined;
  return state;
}

function survivalState(seed: string, difficulty: 'easy' | 'normal' | 'hard' = 'normal') {
  const state = clearEvent(createInitialState(seed, [], 0, difficulty));
  state.phase = 'survival';
  state.prepDay = 7;
  state.survivalDay = 1;
  state.clockMinutes = SURVIVAL_DAY_START;
  state.weather = '晴冷';
  return activateDay(state, 'survival-care');
}

test('三档难度提供递进资源，四件家具均为公寓自带', () => {
  const easy = createInitialState('difficulty', [], 0, 'easy');
  const normal = createInitialState('difficulty', [], 0, 'normal');
  const hard = createInitialState('difficulty', [], 0, 'hard');
  assert.ok(easy.money > normal.money && normal.money > hard.money);
  assert.ok(easy.carryCapacity > normal.carryCapacity && normal.carryCapacity > hard.carryCapacity);
  assert.equal(inventoryCount(easy.inventory, 'water-bottle'), 4);
  assert.equal(Object.keys(easy.furniture).length, 4);
  assert.ok(Object.values(easy.furniture).every((unit) => unit.enabled && unit.condition === 100));
});

test('同种子危险掷骰相同，但简易风险低于标准和艰难', () => {
  const easy = clearEvent(createInitialState('same-risk', [], 0, 'easy'));
  const normal = clearEvent(createInitialState('same-risk', [], 0, 'normal'));
  const hard = clearEvent(createInitialState('same-risk', [], 0, 'hard'));
  const a = rollDanger(easy, 45);
  const b = rollDanger(normal, 45);
  const c = rollDanger(hard, 45);
  assert.equal(a.roll, b.roll);
  assert.equal(b.roll, c.roll);
  assert.ok(a.risk < b.risk && b.risk < c.risk);
});

test('行动按分钟推进，工作每日一次，休息可恢复体力', () => {
  let state = activateDay(clearEvent(createInitialState('clock')), 'prep-income');
  const worked = performPrepAction(state, 'work');
  assert.equal(worked.ok, true);
  assert.equal(worked.state.clockMinutes, PREP_DAY_START + 240);
  assert.equal(performPrepAction(worked.state, 'work').ok, false);
  state = worked.state;
  state.stats.stamina = 30;
  const rested = performPrepAction(state, 'rest');
  assert.equal(rested.ok, true);
  assert.equal(rested.state.clockMinutes, PREP_DAY_START + 360);
  assert.equal(rested.state.stats.stamina, 55);
});

test('行动恰好到日终会自动跨日，时间不足则完全不变', () => {
  const exact = activateDay(clearEvent(createInitialState('exact')), 'prep-income');
  exact.clockMinutes = dayEndMinutes(exact) - 120;
  const next = performPrepAction(exact, 'rest');
  assert.equal(next.ok, true);
  assert.equal(next.state.prepDay, 2);
  assert.equal(next.state.clockMinutes, PREP_DAY_START);

  const tooLate = activateDay(clearEvent(createInitialState('late')), 'prep-income');
  tooLate.clockMinutes = dayEndMinutes(tooLate) - 30;
  const snapshot = structuredClone(tooLate);
  const failed = performPrepAction(tooLate, 'rest');
  assert.equal(failed.ok, false);
  assert.deepEqual(failed.state, snapshot);
});

test('燃气炉和微波炉严格守恒资源并恢复状态', () => {
  const gas = survivalState('gas', 'easy');
  gas.stats.satiety = 30;
  const noodles = inventoryCount(gas.inventory, 'instant-noodles');
  const water = inventoryCount(gas.inventory, 'water-bottle');
  const fuel = gas.shelter.fuel;
  const cooked = performFurnitureAction(gas, 'gas-stove');
  assert.equal(cooked.ok, true);
  assert.equal(cooked.state.clockMinutes, SURVIVAL_DAY_START + 60);
  assert.equal(inventoryCount(cooked.state.inventory, 'instant-noodles'), noodles - 1);
  assert.equal(inventoryCount(cooked.state.inventory, 'water-bottle'), water - 1);
  assert.equal(cooked.state.shelter.fuel, fuel - 2);
  assert.equal(cooked.state.stats.satiety, 68);

  const noPower = survivalState('microwave', 'easy');
  noPower.shelter.power = 0;
  const snapshot = structuredClone(noPower);
  assert.equal(furnitureActionDisabledReason(noPower, 'microwave'), '电力不足 2');
  const failed = performFurnitureAction(noPower, 'microwave');
  assert.equal(failed.ok, false);
  assert.deepEqual(failed.state, snapshot);
});

test('冰箱只延长尚未过期的易腐批次', () => {
  let inventory = addItem({}, ITEM_MAP['fresh-apples'], 2, 8);
  inventory = addItem(inventory, ITEM_MAP['water-bottle'], 1, 8);
  inventory['fresh-apples'][0].expiresOn = 9;
  const cold = extendColdStorage(inventory, 8);
  assert.equal(cold.preserved, 2);
  assert.equal(cold.inventory['fresh-apples'][0].expiresOn, 10);
  assert.equal(cold.inventory['water-bottle'][0].expiresOn, undefined);

  inventory['fresh-apples'][0].expiresOn = 7;
  const stale = extendColdStorage(inventory, 8);
  assert.equal(stale.preserved, 0);
  assert.equal(stale.inventory['fresh-apples'][0].expiresOn, 7);
});

test('简易推荐采购标签只挂在可购买物品且含明确目标', () => {
  const planned = ITEMS.filter((item) => item.easyPlan);
  assert.ok(planned.length >= 10);
  assert.ok(planned.every((item) => item.store && (item.easyPlan?.target ?? 0) > 0));
});

test('简易难度夜间消耗更低且更早达成普通撤离', () => {
  const easy = survivalState('easy-night', 'easy');
  easy.survivalDay = 10;
  easy.inventory = {};
  easy.shelter.water = 0;
  easy.shelter.power = 0;
  const before = easy.stats.satiety;
  const result = endDay(easy);
  assert.ok(result.state.dailySettlement?.finalNight);
  const rewarded = claimDailyReward(result.state, 'quiet-rest');
  assert.equal(rewarded.ok, true);
  const escaped = chooseEvacuation(rewarded.state, 'survivor');
  assert.equal(escaped.state.phase, 'ended');
  assert.equal(escaped.state.outcome?.id, 'survivor');
  assert.equal(before - result.state.stats.satiety, 13);
});
