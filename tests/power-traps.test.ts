import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_MAP } from '../game/data/items.ts';
import { addItem, inventoryCount } from '../game/engine/inventory.ts';
import { setPowerTrapArmed, upgradePowerTrap } from '../game/engine/power-traps.ts';
import { resolveHardSiegeWave, siegeAttack, siegeDamage, siegeWaveForDay } from '../game/engine/siege.ts';
import { createInitialState } from '../game/engine/state.ts';
import { SURVIVAL_DAY_START } from '../game/engine/time.ts';
import { activateDay } from './helpers.ts';

function hardState() {
  const state = activateDay(createInitialState('powered-trap', [], 0, 'hard'), 'survival-secure');
  state.phase = 'survival';
  state.survivalDay = 8;
  state.clockMinutes = SURVIVAL_DAY_START;
  state.currentEventId = undefined;
  state.shelter.integrity = 100;
  state.shelter.power = 8;
  state.inventory = addItem(state.inventory, ITEM_MAP['copper-wire'], 1, 8);
  state.inventory = addItem(state.inventory, ITEM_MAP.batteries, 1, 8);
  return state;
}

test('电力陷阱建设严格消耗材料，可主动接通或断开', () => {
  const state = hardState();
  const built = upgradePowerTrap(state);
  assert.equal(built.ok, true);
  assert.deepEqual(built.state.powerTrap, { level: 1, armed: true });
  assert.equal(inventoryCount(built.state.inventory, 'copper-wire'), 0);
  assert.equal(inventoryCount(built.state.inventory, 'batteries'), 0);
  const disconnected = setPowerTrapArmed(built.state, false);
  assert.equal(disconnected.ok, true);
  assert.equal(disconnected.state.powerTrap.armed, false);
});

test('困难波次先扣主动攻击再计算加固，电力不足时陷阱不会虚假生效', () => {
  const state = hardState();
  state.powerTrap = { level: 1, armed: true };
  state.shelter.reinforcement = 2;
  const wave = siegeWaveForDay(state)!;
  assert.equal(siegeAttack(state), 5);
  assert.equal(siegeDamage(state, wave), 11);
  const resolved = resolveHardSiegeWave(state);
  assert.equal(resolved.shelter.integrity, 89);
  assert.equal(resolved.shelter.power, 5);
  assert.match(resolved.logs.at(-1)?.body ?? '', /冲击 20 - 主动攻击 5 - 加固吸收 4 = 实际损伤 11/);

  const powerless = hardState();
  powerless.powerTrap = { level: 1, armed: true };
  powerless.shelter.power = 1;
  assert.equal(siegeAttack(powerless), 0);
  assert.match(resolveHardSiegeWave(powerless).logs.at(-1)?.body ?? '', /电力不足 2/);
});
