import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_MAP, ITEMS } from '../game/data/items.ts';
import { RECIPES } from '../game/data/recipes.ts';
import { exploreLocation, performPrepAction, performSurvivalAction } from '../game/engine/actions.ts';
import { continueAfterMissedWish } from '../game/engine/daily.ts';
import { endDay, extendColdStorage } from '../game/engine/day.ts';
import { availableCookingRecipes, cookingSuccessChance, furnitureActionDisabledReason, performFurnitureAction } from '../game/engine/furniture.ts';
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
  assert.equal(easy.autoRations, true);
  assert.equal(normal.autoRations, false);
  assert.equal(hard.autoRations, false);
  assert.equal(Object.keys(easy.furniture).length, 4);
  assert.ok(Object.values(easy.furniture).every((unit) => unit.enabled && unit.condition === 100));
});

test('自动补充关闭时只结算基础消耗，不擅自使用物资或水箱', () => {
  const manual = survivalState('manual-rations', 'normal');
  manual.autoRations = false;
  manual.stats.satiety = 55;
  manual.stats.hydration = 55;
  manual.inventory = addItem(manual.inventory, ITEM_MAP.crackers, 1, 8);
  manual.inventory = addItem(manual.inventory, ITEM_MAP['water-bottle'], 1, 8);
  manual.shelter.water = 12;
  const result = endDay(manual);
  assert.equal(inventoryCount(result.state.inventory, 'crackers'), 1);
  assert.equal(inventoryCount(result.state.inventory, 'water-bottle'), 1);
  assert.equal(result.state.shelter.water, 12);
  assert.ok(result.state.logs.some((log) => log.body.includes('自动补充已关闭')));
});

test('标准与艰难的重复探索产出受限，艰难可能空手返回', () => {
  for (const difficulty of ['normal', 'hard'] as const) {
    let state = survivalState(`repeat-loot-${difficulty}`, difficulty);
    state.stats.stamina = 100;
    state = exploreLocation(state, 'qinghe-clinic').state;
    state.currentEventId = undefined;
    state.stats.stamina = 100;
    const repeated = exploreLocation(state, 'qinghe-clinic');
    assert.equal(repeated.ok, true);
    const explorationLog = [...repeated.state.logs].reverse().find((log) => log.title.startsWith('探索 ·'));
    assert.equal(explorationLog?.body.includes('没有能带走的物资'), difficulty === 'hard');
  }
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

test('随机料理严格消耗食材与储水，并生成有保质期的成品', () => {
  const gas = survivalState('gas', 'easy');
  gas.inventory = addItem(gas.inventory, ITEM_MAP.rice, 1, 8);
  gas.inventory = addItem(gas.inventory, ITEM_MAP['dried-vegetables'], 1, 8);
  const riceBefore = inventoryCount(gas.inventory, 'rice');
  const vegetablesBefore = inventoryCount(gas.inventory, 'dried-vegetables');
  gas.shelter.water = 10;
  const fuel = gas.shelter.fuel;
  const cooked = performFurnitureAction(gas, 'gas-stove');
  assert.equal(cooked.ok, true);
  assert.equal(cooked.state.clockMinutes, SURVIVAL_DAY_START + 75);
  assert.equal(inventoryCount(cooked.state.inventory, 'rice'), riceBefore - 1);
  assert.equal(inventoryCount(cooked.state.inventory, 'dried-vegetables'), vegetablesBefore - 1);
  assert.equal(cooked.state.shelter.water, 6);
  assert.equal(cooked.state.shelter.fuel, fuel - 2);
  assert.equal(cooked.state.cookingAttempts, 1);
  assert.equal(inventoryCount(cooked.state.inventory, 'dish-vegetable-congee') + inventoryCount(cooked.state.inventory, 'scorched-meal'), 1);

  const noPower = survivalState('microwave', 'easy');
  noPower.shelter.power = 0;
  const snapshot = structuredClone(noPower);
  assert.equal(furnitureActionDisabledReason(noPower, 'microwave'), '电力不足 2');
  const failed = performFurnitureAction(noPower, 'microwave');
  assert.equal(failed.ok, false);
  assert.deepEqual(failed.state, snapshot);
});

test('每三次料理提升技能并提高后续成功率', () => {
  let state = survivalState('cooking-level', 'normal');
  state.shelter.power = 30;
  state.shelter.water = 30;
  state.inventory = addItem(state.inventory, ITEM_MAP.oats, 3, 8);
  state.inventory = addItem(state.inventory, ITEM_MAP['milk-powder'], 3, 8);
  const initialChance = cookingSuccessChance(state);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = performFurnitureAction(state, 'microwave');
    assert.equal(result.ok, true);
    state = result.state;
  }
  assert.equal(state.cookingAttempts, 3);
  assert.equal(state.cookingSkill, 1);
  assert.ok(cookingSuccessChance(state) > initialChance);
});

test('储水可以主动饮用，料理池至少包含十二种不同组合', () => {
  const state = survivalState('stored-water', 'normal');
  state.shelter.water = 8;
  state.stats.hydration = 40;
  const drank = performSurvivalAction(state, 'drink-storage');
  assert.equal(drank.ok, true);
  assert.equal(drank.state.shelter.water, 4);
  assert.equal(drank.state.stats.hydration, 66);
  assert.ok(RECIPES.length >= 12);
  assert.ok(ITEMS.length >= 65);
  for (const appliance of ['gas-stove', 'microwave', 'electric-hotpot'] as const) {
    assert.ok(RECIPES.filter((recipe) => recipe.appliance === appliance).length >= 4);
  }
  for (const recipe of RECIPES) {
    assert.ok(ITEM_MAP[recipe.output], `${recipe.id} 缺少料理成品`);
    for (const ingredient of Object.keys(recipe.ingredients)) assert.ok(ITEM_MAP[ingredient], `${recipe.id} 缺少食材 ${ingredient}`);
  }
  assert.equal(availableCookingRecipes(state, 'gas-stove').length, 0);
});

test('相同种子与库存得到相同的随机料理结果', () => {
  const prepare = () => {
    const state = survivalState('same-cooking', 'easy');
    state.shelter.power = 20;
    state.shelter.water = 20;
    state.inventory = addItem(state.inventory, ITEM_MAP.oats, 1, 8);
    state.inventory = addItem(state.inventory, ITEM_MAP['milk-powder'], 1, 8);
    state.inventory = addItem(state.inventory, ITEM_MAP['canned-beans'], 1, 8);
    state.inventory = addItem(state.inventory, ITEM_MAP['luncheon-meat'], 1, 8);
    return state;
  };
  assert.deepEqual(performFurnitureAction(prepare(), 'microwave'), performFurnitureAction(prepare(), 'microwave'));
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
  const continued = continueAfterMissedWish(result.state);
  assert.equal(continued.ok, true);
  const escaped = chooseEvacuation(continued.state, 'survivor');
  assert.equal(escaped.state.phase, 'ended');
  assert.equal(escaped.state.outcome?.id, 'survivor');
  assert.equal(before - result.state.stats.satiety, 13);
});
