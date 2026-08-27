import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_MAP } from '../game/data/items.ts';
import { performPrepAction, performSurvivalAction, useItem } from '../game/engine/actions.ts';
import { endDay } from '../game/engine/day.ts';
import { addItem, inventoryCount } from '../game/engine/inventory.ts';
import { powerUpgradeSpec, projectedPowerNights, setPowerPolicy } from '../game/engine/power.ts';
import { createInitialState } from '../game/engine/state.ts';
import { SURVIVAL_DAY_START } from '../game/engine/time.ts';
import { activateDay } from './helpers.ts';

function prepState(seed: string) {
  const state = activateDay(createInitialState(seed), 'prep-home');
  state.currentEventId = undefined;
  state.money = 1000;
  return state;
}

function survivalState(seed: string) {
  const state = activateDay(createInitialState(seed), 'survival-care');
  state.phase = 'survival';
  state.prepDay = 7;
  state.survivalDay = 1;
  state.clockMinutes = SURVIVAL_DAY_START;
  state.currentEventId = undefined;
  state.weather = '晴冷';
  state.autoRations = false;
  state.shelter.power = 10;
  state.stats.morale = 60;
  state.inventory = addItem({}, ITEM_MAP['fresh-apples'], 1, 8);
  return state;
}

test('供电改造分三级，费用、时间和新增电力均实际结算', () => {
  let state = prepState('power-levels');
  for (const expected of [
    { level: 1, money: 110, minutes: 180, power: 7 },
    { level: 2, money: 90, minutes: 120, power: 8 },
    { level: 3, money: 120, minutes: 120, power: 7 },
  ]) {
    const spec = powerUpgradeSpec(state)!;
    assert.deepEqual({ level: spec.level, money: spec.money, minutes: spec.minutes, power: spec.power }, expected);
    const moneyBefore = state.money;
    const powerBefore = state.shelter.power;
    const result = performPrepAction(state, 'power');
    assert.equal(result.ok, true);
    state = result.state;
    assert.equal(state.money, moneyBefore - expected.money);
    assert.equal(state.shelter.power, powerBefore + expected.power);
    assert.equal(state.shelter.generator, expected.level);
  }
  assert.equal(powerUpgradeSpec(state), null);
  assert.equal(performPrepAction(state, 'power').ok, false);
});

test('停电演练必须先有改造且每轮只能完成一次', () => {
  const fresh = prepState('power-drill');
  assert.equal(performPrepAction(fresh, 'drill').ok, false);
  const upgraded = performPrepAction(fresh, 'power').state;
  const powerBefore = upgraded.shelter.power;
  const drilled = performPrepAction(upgraded, 'drill');
  assert.equal(drilled.ok, true);
  assert.equal(drilled.state.shelter.power, powerBefore + 2);
  assert.equal(drilled.state.intel, upgraded.intel + 1);
  assert.ok(drilled.state.flags.includes('power-audited'));
  assert.equal(performPrepAction(drilled.state, 'drill').ok, false);
});

test('供电策略切换不推进时钟，并在夜间产生不同可追踪后果', () => {
  const base = survivalState('power-policies');
  for (const [policy, expectedPower, expectedMoraleDelta, expiryGain] of [
    ['balanced', 8, 0, 1],
    ['cold', 8, -3, 2],
    ['light', 8, 3, 0],
    ['off', 10, -6, 0],
  ] as const) {
    let state = structuredClone(base);
    const initialClock = state.clockMinutes;
    if (policy !== 'balanced') {
      const selected = setPowerPolicy(state, policy);
      assert.equal(selected.ok, true);
      state = selected.state;
      assert.equal(state.clockMinutes, initialClock);
    }
    const expiryBefore = state.inventory['fresh-apples'][0].expiresOn!;
    const result = endDay(state);
    assert.equal(result.ok, true);
    assert.equal(result.state.shelter.power, expectedPower);
    assert.equal(result.state.stats.morale, 60 + expectedMoraleDelta);
    assert.equal(result.state.inventory['fresh-apples'][0].expiresOn, expiryBefore + expiryGain);
    assert.ok(result.state.logs.some((log) => log.body.includes(`供电策略：`) && log.body.includes('电力 10 →')));
  }
});

test('低电量不会透支，供电失败会明确写入日志', () => {
  const state = survivalState('power-shortage');
  state.powerPolicy = 'cold';
  state.shelter.power = 1;
  const result = endDay(state);
  assert.equal(result.state.shelter.power, 1);
  assert.ok(result.state.shelter.power >= 0);
  assert.ok(result.state.logs.some((log) => log.body.includes('电力不足 2 点')));
});

test('电池与燃料换电不再覆盖整局，困难后期续航包含警戒线负载', () => {
  let state = survivalState('energy-budget');
  state.difficulty = 'hard';
  state.survivalDay = 9;
  state.shelter.power = 0;
  state.shelter.fuel = 0;
  state.shelter.generator = 1;
  state.inventory = addItem(state.inventory, ITEM_MAP.batteries, 1, 8);
  state.inventory = addItem(state.inventory, ITEM_MAP['fuel-can'], 1, 8);
  assert.equal(performSurvivalAction(state, 'generator').ok, false, '只有供电改造，没有发电机本体时不能烧油发电');
  state.inventory = addItem(state.inventory, ITEM_MAP['fuel-generator'], 1, 8);
  state = useItem(state, 'batteries').state;
  state = useItem(state, 'fuel-can').state;
  assert.equal(state.shelter.power, 3);
  assert.equal(state.shelter.fuel, 6);
  state = performSurvivalAction(state, 'generator').state;
  state = performSurvivalAction(state, 'generator').state;
  assert.equal(state.shelter.power, 13);
  assert.equal(state.shelter.fuel, 0);
  assert.equal(inventoryCount(state.inventory, 'fuel-generator'), 1, '发电机本体不会在运行后消耗');
  assert.equal(performSurvivalAction(state, 'generator').ok, false);
  assert.equal(projectedPowerNights(state), 4, '均衡供电 2 + 困难警戒 1，应按每夜 3 电计算');
});
