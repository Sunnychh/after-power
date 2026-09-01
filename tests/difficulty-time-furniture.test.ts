import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_MAP, ITEMS } from '../game/data/items.ts';
import { RECIPES } from '../game/data/recipes.ts';
import { exploreLocation, performPrepAction, performSurvivalAction } from '../game/engine/actions.ts';
import { continueAfterMissedWish } from '../game/engine/daily.ts';
import { endDay, extendColdStorage } from '../game/engine/day.ts';
import { availableCookingIngredients, availableCookingRecipes, cookingSelectionInsight, cookingSuccessChance, furnitureActionDisabledReason, performFurnitureAction } from '../game/engine/furniture.ts';
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
  assert.equal(createInitialState('normal-opt-in', [], 0, 'normal', true).autoRations, true);
  assert.equal(createInitialState('hard-opt-in', [], 0, 'hard', true).autoRations, true);
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

test('储水可以主动饮用，三种厨具各有十四种不重复组合且覆盖二至四种食材', () => {
  const state = survivalState('stored-water', 'normal');
  state.shelter.water = 8;
  state.stats.hydration = 40;
  const drank = performSurvivalAction(state, 'drink-storage');
  assert.equal(drank.ok, true);
  assert.equal(drank.state.shelter.water, 4);
  assert.equal(drank.state.stats.hydration, 68);
  assert.ok(RECIPES.length >= 42);
  assert.ok(ITEMS.length >= 80);
  const combinationKeys = new Set<string>();
  for (const appliance of ['gas-stove', 'microwave', 'electric-hotpot'] as const) {
    assert.ok(RECIPES.filter((recipe) => recipe.appliance === appliance).length >= 14);
  }
  for (const recipe of RECIPES) {
    const combinationKey = `${recipe.appliance}:${Object.entries(recipe.ingredients).sort(([left], [right]) => left.localeCompare(right)).map(([itemId, quantity]) => `${itemId}x${quantity}`).join('+')}`;
    assert.equal(combinationKeys.has(combinationKey), false, `${recipe.appliance} 存在重复食材组合 ${combinationKey}`);
    combinationKeys.add(combinationKey);
    assert.ok(ITEM_MAP[recipe.output], `${recipe.id} 缺少料理成品`);
    for (const ingredient of Object.keys(recipe.ingredients)) assert.ok(ITEM_MAP[ingredient], `${recipe.id} 缺少食材 ${ingredient}`);
  }
  const ingredientCounts = new Set(RECIPES.map((recipe) => Object.values(recipe.ingredients).reduce((sum, quantity) => sum + quantity, 0)));
  assert.ok(ingredientCounts.has(2));
  assert.ok(ingredientCounts.has(3));
  assert.ok(ingredientCounts.has(4));
  assert.equal(availableCookingRecipes(state, 'gas-stove').length, 0);
});

test('玩家必须明确选择料理水源，储水器和瓶装水都会严格扣除', () => {
  let storedSucceeded = false;
  for (let index = 0; index < 40 && !storedSucceeded; index += 1) {
    const state = survivalState(`selected-stored-water-${index}`, 'easy');
    state.cookingSkill = 5;
    state.shelter.power = 12;
    state.shelter.water = 9;
    state.inventory = addItem({}, ITEM_MAP['frozen-dumplings'], 1, 8);
    const dryInsight = cookingSelectionInsight(state, 'electric-hotpot', ['frozen-dumplings'], 'none');
    assert.match(dryInsight.label, /尚未选择用水/);
    const result = performFurnitureAction(state, 'electric-hotpot', ['frozen-dumplings'], 'shelter');
    if (result.state.discoveredRecipes.includes('plain-dumplings')) {
      storedSucceeded = true;
      assert.equal(result.state.shelter.water, 5);
      assert.equal(inventoryCount(result.state.inventory, 'dish-boiled-dumplings'), 1);
    }
  }
  assert.equal(storedSucceeded, true);

  const bottled = survivalState('selected-bottled-water', 'easy');
  bottled.cookingSkill = 5;
  bottled.shelter.power = 12;
  bottled.shelter.water = 0;
  bottled.inventory = addItem({}, ITEM_MAP['frozen-dumplings'], 1, 8);
  bottled.inventory = addItem(bottled.inventory, ITEM_MAP['water-bottle'], 1, 8);
  const result = performFurnitureAction(bottled, 'electric-hotpot', ['frozen-dumplings'], 'bottle');
  assert.equal(result.ok, true);
  assert.equal(inventoryCount(result.state.inventory, 'water-bottle'), 0);
  assert.match([...result.state.logs].reverse().find((log) => log.title.startsWith('电火锅'))?.body ?? '', /加入瓶装水/);
});

test('未掌握组合下锅前保持未知，只对即兴组合提示更高失败可能', () => {
  const state = survivalState('recipe-mystery', 'normal');
  state.shelter.power = 12;
  state.shelter.water = 12;
  state.inventory = addItem({}, ITEM_MAP.oats, 1, 8);
  state.inventory = addItem(state.inventory, ITEM_MAP['milk-powder'], 1, 8);
  state.inventory = addItem(state.inventory, ITEM_MAP['canned-beans'], 1, 8);

  const unknown = cookingSelectionInsight(state, 'microwave', ['oats', 'milk-powder']);
  assert.equal(unknown.status, 'unknown');
  assert.match(unknown.label, /未知结果/);
  assert.equal(unknown.label.includes('奶香燕麦糊'), false);

  const risky = cookingSelectionInsight(state, 'microwave', ['canned-beans']);
  assert.equal(risky.status, 'risky');
  assert.match(risky.label, /失败可能性较大/);
  assert.ok((risky.chance ?? 100) < (unknown.chance ?? 0));

  state.shelter.water = 0;
  const underSuppliedRecipe = cookingSelectionInsight(state, 'microwave', ['oats', 'milk-powder']);
  assert.equal(underSuppliedRecipe.status, 'risky');
  assert.match(underSuppliedRecipe.label, /搭配似乎有章法/);
  assert.match(underSuppliedRecipe.label, /可用水不足/);
  assert.equal(underSuppliedRecipe.label.includes('奶香燕麦糊'), false);

  state.shelter.water = 12;
  state.discoveredRecipes.push('milk-oatmeal');
  const known = cookingSelectionInsight(state, 'microwave', ['oats', 'milk-powder']);
  assert.equal(known.status, 'known');
  assert.match(known.label, /奶香燕麦糊/);
});

test('未知配方失败后不会在料理日志泄露菜名', () => {
  let checkedFailure = false;
  for (let index = 0; index < 80 && !checkedFailure; index += 1) {
    const state = survivalState(`hidden-recipe-failure-${index}`, 'hard');
    state.shelter.power = 12;
    state.shelter.water = 12;
    state.inventory = addItem({}, ITEM_MAP.oats, 1, 8);
    state.inventory = addItem(state.inventory, ITEM_MAP['milk-powder'], 1, 8);
    const result = performFurnitureAction(state, 'microwave', ['oats', 'milk-powder']);
    if (!result.state.discoveredRecipes.includes('milk-oatmeal')) {
      checkedFailure = true;
      const log = [...result.state.logs].reverse().find((entry) => entry.title.startsWith('微波炉'));
      assert.equal(log?.title.includes('奶香燕麦糊'), false);
      assert.equal(log?.body.includes('奶香燕麦糊'), false);
      assert.match(log?.body ?? '', /未知组合成功判定/);
    }
  }
  assert.equal(checkedFailure, true);
});

test('储水不足四单位时仍可逐单位取用，自动配给也不会留下尾水', () => {
  const manual = survivalState('water-tail-manual', 'normal');
  manual.shelter.water = 2;
  manual.stats.hydration = 45;
  const drank = performSurvivalAction(manual, 'drink-storage');
  assert.equal(drank.ok, true);
  assert.equal(drank.state.shelter.water, 0);
  assert.equal(drank.state.stats.hydration, 59);

  const automatic = survivalState('water-tail-auto', 'easy');
  automatic.autoRations = true;
  automatic.shelter.water = 3;
  automatic.stats.hydration = 30;
  automatic.inventory = {};
  const settled = endDay(automatic).state;
  assert.equal(settled.shelter.water, 0);
  assert.ok(settled.logs.some((log) => log.body.includes('水箱储水 3 单位')));
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

test('玩家自选食材只消耗所选组合，成功后把配方写入图鉴', () => {
  let successful = false;
  for (let index = 0; index < 40 && !successful; index += 1) {
    const state = survivalState(`selected-recipe-${index}`, 'easy');
    state.cookingSkill = 5;
    state.shelter.power = 10;
    state.shelter.water = 10;
    state.inventory = addItem({}, ITEM_MAP.oats, 1, 8);
    state.inventory = addItem(state.inventory, ITEM_MAP['milk-powder'], 1, 8);
    state.inventory = addItem(state.inventory, ITEM_MAP['canned-beans'], 1, 8);
    const result = performFurnitureAction(state, 'microwave', ['oats', 'milk-powder']);
    if (result.state.discoveredRecipes.includes('milk-oatmeal')) {
      successful = true;
      assert.equal(inventoryCount(result.state.inventory, 'oats'), 0);
      assert.equal(inventoryCount(result.state.inventory, 'milk-powder'), 0);
      assert.equal(inventoryCount(result.state.inventory, 'canned-beans'), 1);
      assert.equal(inventoryCount(result.state.inventory, 'dish-milk-oatmeal'), 1);
    }
  }
  assert.equal(successful, true);
});

test('不完整食材不会锁住厨具，任何未烹饪食物都能尝试即兴料理', () => {
  const state = survivalState('improvise-any-food', 'normal');
  state.shelter.power = 6;
  state.inventory = addItem({}, ITEM_MAP['canned-beans'], 1, 8);
  assert.equal(availableCookingRecipes(state, 'microwave').length, 0);
  assert.equal(availableCookingIngredients(state).some((item) => item.id === 'canned-beans'), true);
  assert.equal(furnitureActionDisabledReason(state, 'microwave'), null);
  const result = performFurnitureAction(state, 'microwave');
  assert.equal(result.ok, true);
  assert.equal(inventoryCount(result.state.inventory, 'canned-beans'), 0);
  assert.equal(inventoryCount(result.state.inventory, 'dish-improvised-meal') + inventoryCount(result.state.inventory, 'scorched-meal'), 1);
  assert.ok(result.state.logs.some((log) => log.body.includes('即兴成功判定')));
});

test('速冻水饺加一瓶水可成为清水煮饺子，缺水也能开火并得到对应成品', () => {
  const withWater = survivalState('plain-dumplings', 'easy');
  withWater.shelter.power = 8;
  withWater.shelter.water = 0;
  withWater.cookingSkill = 5;
  withWater.inventory = addItem({}, ITEM_MAP['frozen-dumplings'], 1, 8);
  withWater.inventory = addItem(withWater.inventory, ITEM_MAP['water-bottle'], 1, 8);
  assert.ok(availableCookingRecipes(withWater, 'electric-hotpot').some((recipe) => recipe.id === 'plain-dumplings'));
  const boiled = performFurnitureAction(withWater, 'electric-hotpot');
  assert.equal(boiled.ok, true);
  assert.equal(inventoryCount(boiled.state.inventory, 'frozen-dumplings'), 0);
  assert.equal(inventoryCount(boiled.state.inventory, 'water-bottle'), 0);
  assert.equal(inventoryCount(boiled.state.inventory, 'dish-boiled-dumplings') + inventoryCount(boiled.state.inventory, 'scorched-meal'), 1);

  const dry = survivalState('dry-dumplings', 'normal');
  dry.shelter.power = 8;
  dry.shelter.water = 0;
  dry.inventory = addItem({}, ITEM_MAP['frozen-dumplings'], 1, 8);
  assert.equal(availableCookingRecipes(dry, 'electric-hotpot').length, 0);
  assert.equal(furnitureActionDisabledReason(dry, 'electric-hotpot'), null);
  const fried = performFurnitureAction(dry, 'electric-hotpot');
  assert.equal(fried.ok, true);
  assert.equal(inventoryCount(fried.state.inventory, 'frozen-dumplings'), 0);
  assert.equal(inventoryCount(fried.state.inventory, 'dish-dry-dumplings') + inventoryCount(fried.state.inventory, 'dish-scorched-dumplings'), 1);
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
