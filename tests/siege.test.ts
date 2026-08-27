import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_MAP } from '../game/data/items.ts';
import { performSurvivalAction } from '../game/engine/actions.ts';
import { addItem, inventoryCount } from '../game/engine/inventory.ts';
import { nextSiegeWave, resolveHardSiegeWave, siegeDamage, siegeMitigation, siegeWaveForDay } from '../game/engine/siege.ts';
import { createInitialState } from '../game/engine/state.ts';
import { determineOutcome } from '../game/engine/outcomes.ts';
import { SURVIVAL_DAY_START } from '../game/engine/time.ts';
import { activateDay } from './helpers.ts';

function survivalState(difficulty: 'easy' | 'normal' | 'hard' = 'hard') {
  const state = activateDay(createInitialState('siege-test', [], 0, difficulty), 'survival-secure');
  state.phase = 'survival';
  state.prepDay = 7;
  state.survivalDay = 3;
  state.clockMinutes = SURVIVAL_DAY_START;
  state.currentEventId = undefined;
  state.shelter.integrity = 80;
  return state;
}

test('困难模式前期两次试探，第八夜起连续七夜升级围攻', () => {
  const hard = survivalState('hard');
  assert.equal(siegeWaveForDay(hard)?.pressure, 9);
  assert.equal(nextSiegeWave(hard)?.day, 3);
  const lateWaves = [8, 9, 10, 11, 12, 13, 14].map((day) => {
    hard.survivalDay = day;
    return siegeWaveForDay(hard)!;
  });
  assert.deepEqual(lateWaves.map((wave) => wave.day), [8, 9, 10, 11, 12, 13, 14]);
  assert.deepEqual(lateWaves.map((wave) => wave.pressure), [20, 21, 23, 25, 27, 30, 34]);
  assert.ok(lateWaves.every((wave, index) => index === 0 || wave.pressure > lateWaves[index - 1].pressure));
  assert.equal(siegeWaveForDay(survivalState('normal')), undefined);
  assert.equal(siegeWaveForDay(survivalState('easy')), undefined);
});

test('波次损伤由冲击减去可见加固吸收，并且不会重复结算', () => {
  const state = survivalState('hard');
  state.shelter.reinforcement = 2;
  state.flags.push('horde-prepared');
  const wave = siegeWaveForDay(state)!;
  assert.equal(siegeMitigation(state), 7);
  assert.equal(siegeDamage(state, wave), 2);
  const resolved = resolveHardSiegeWave(state);
  assert.equal(resolved.shelter.integrity, 78);
  assert.ok(resolved.flags.includes('siege-wave:3'));
  assert.ok(resolved.logs.at(-1)?.body.includes('冲击 9 - 加固吸收 7 = 实际损伤 2'));
  assert.deepEqual(resolveHardSiegeWave(resolved), resolved);
});

test('大型波次即使被挡住也会磨损加固，迫使后期持续补强', () => {
  const state = survivalState('hard');
  state.survivalDay = 12;
  state.shelter.reinforcement = 14;
  state.flags.push('horde-prepared');
  const wave = siegeWaveForDay(state)!;
  assert.equal(siegeDamage(state, wave), 0);
  const resolved = resolveHardSiegeWave(state);
  assert.equal(resolved.shelter.integrity, 80);
  assert.equal(resolved.shelter.reinforcement, 12);
  assert.match(resolved.logs.at(-1)?.body ?? '', /加固 14 → 12/);
});

test('没有持续维护时后期连续波次会迅速压垮同一套静态加固', () => {
  let state = survivalState('hard');
  state.survivalDay = 8;
  state.shelter.integrity = 100;
  state.shelter.reinforcement = 6;
  state.flags.push('horde-prepared');
  const damages: number[] = [];
  for (let day = 8; day <= 14; day += 1) {
    state.survivalDay = day;
    const wave = siegeWaveForDay(state)!;
    damages.push(siegeDamage(state, wave));
    state = resolveHardSiegeWave(state);
  }
  assert.ok(damages.at(-1)! > damages[0]);
  assert.equal(state.shelter.reinforcement, 0);
  assert.equal(state.shelter.integrity, 0);
});

test('木板与钢板形成不同强度的主动加固方案', () => {
  const wood = survivalState('hard');
  wood.inventory = addItem(wood.inventory, ITEM_MAP['wood-board'], 1, 8);
  const woodResult = performSurvivalAction(wood, 'barricade');
  assert.equal(woodResult.ok, true);
  assert.equal(woodResult.state.shelter.reinforcement, 1);
  assert.equal(woodResult.state.shelter.integrity, 100);
  assert.equal(inventoryCount(woodResult.state.inventory, 'wood-board'), 0);

  const steel = survivalState('hard');
  steel.inventory = addItem(steel.inventory, ITEM_MAP['metal-sheet'], 1, 8);
  assert.equal(performSurvivalAction(steel, 'plate').ok, false);
  steel.inventory = addItem(steel.inventory, ITEM_MAP.toolkit, 1, 8);
  const steelResult = performSurvivalAction(steel, 'plate');
  assert.equal(steelResult.ok, true);
  assert.equal(steelResult.state.shelter.reinforcement, 2);
  assert.equal(steelResult.state.shelter.integrity, 100);
  assert.equal(inventoryCount(steelResult.state.inventory, 'metal-sheet'), 0);
});

test('非主潮波次导致失守时生成对应的困难模式死亡记录', () => {
  const state = survivalState('hard');
  state.shelter.integrity = 0;
  state.flags.push('siege-wave:3');
  const outcome = determineOutcome(state);
  assert.equal(outcome?.variantId, 'death-siege-3');
  assert.ok(outcome?.keyChoices.includes('困难波次第 3 夜'));
});
