import { ITEM_MAP } from '../data/items.ts';
import { FAILED_COOKING_EFFECT, RECIPES_BY_APPLIANCE, type CookingApplianceId, type CookingRecipe } from '../data/recipes.ts';
import type { GameState } from '../types.ts';
import { completeTimedAction, type EngineResult } from './day.ts';
import { dailyActionBlockedReason } from './daily.ts';
import { inventoryCount } from './inventory.ts';
import { randomInt, seededPick } from './rng.ts';
import { absoluteDay, applyEffect, clamp, createLog } from './state.ts';
import { timeDisabledReason } from './time.ts';

export type FurnitureActionId = CookingApplianceId;

export const FURNITURE_ACTION_MINUTES: Record<FurnitureActionId, number> = {
  'gas-stove': 75,
  microwave: 30,
  'electric-hotpot': 90,
};

function bottledWaterCost(recipe: CookingRecipe): number {
  return recipe.water > 0 ? Math.ceil(recipe.water / 4) : 0;
}

function hasRecipeWater(state: GameState, recipe: CookingRecipe): boolean {
  return recipe.water === 0
    || state.shelter.water >= recipe.water
    || inventoryCount(state.inventory, 'water-bottle') >= bottledWaterCost(recipe);
}

function hasRecipeIngredients(state: GameState, recipe: CookingRecipe): boolean {
  return Object.entries(recipe.ingredients).every(([itemId, quantity]) => inventoryCount(state.inventory, itemId) >= quantity);
}

export function availableCookingRecipes(state: GameState, action: FurnitureActionId): CookingRecipe[] {
  return RECIPES_BY_APPLIANCE[action]
    .filter((recipe) => {
      const hasEnergy = action === 'gas-stove' ? state.shelter.fuel >= recipe.energy : state.shelter.power >= recipe.energy;
      return hasEnergy && hasRecipeIngredients(state, recipe) && hasRecipeWater(state, recipe);
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function cookingSuccessChance(state: GameState): number {
  const difficultyAdjustment = state.difficulty === 'easy' ? 10 : state.difficulty === 'hard' ? -6 : 0;
  return clamp(58 + state.cookingSkill * 8 + difficultyAdjustment, 35, 96);
}

export function cookingPreview(state: GameState, action: FurnitureActionId): { recipes: number; chance: number; skill: number; attemptsToNext: number } {
  return {
    recipes: availableCookingRecipes(state, action).length,
    chance: cookingSuccessChance(state),
    skill: state.cookingSkill,
    attemptsToNext: state.cookingSkill >= 5 ? 0 : 3 - (state.cookingAttempts % 3),
  };
}

function energyDisabledReason(state: GameState, action: FurnitureActionId): string | null {
  const minimum = Math.min(...RECIPES_BY_APPLIANCE[action].map((recipe) => recipe.energy));
  if (action === 'gas-stove' && state.shelter.fuel < minimum) return `燃料不足 ${minimum}`;
  if (action !== 'gas-stove' && state.shelter.power < minimum) return `电力不足 ${minimum}`;
  return null;
}

export function furnitureActionDisabledReason(state: GameState, action: FurnitureActionId): string | null {
  if (state.phase !== 'survival') return '封锁后才需要启用厨房储备';
  const daily = dailyActionBlockedReason(state);
  if (daily) return daily;
  const timed = timeDisabledReason(state, FURNITURE_ACTION_MINUTES[action]);
  if (timed) return timed;
  if (!state.furniture[action].enabled || state.furniture[action].condition <= 0) return '家具当前不可用';
  const energy = energyDisabledReason(state, action);
  if (energy) return energy;
  if (!availableCookingRecipes(state, action).length) {
    const example = action === 'gas-stove' ? '例如米砖＋脱水蔬菜' : action === 'microwave' ? '例如燕麦＋奶粉' : '例如素饺＋脱水蔬菜';
    return `没有可组合的配方；${example}，并准备储水或瓶装水`;
  }
  return null;
}

function cookingInventoryEffect(recipe: CookingRecipe, output: string): Record<string, number> {
  const inventory: Record<string, number> = { [output]: 1 };
  for (const [itemId, quantity] of Object.entries(recipe.ingredients)) inventory[itemId] = -quantity;
  return inventory;
}

export function performFurnitureAction(state: GameState, action: FurnitureActionId): EngineResult {
  const disabled = furnitureActionDisabledReason(state, action);
  if (disabled) return { state, ok: false, message: disabled };

  let next = structuredClone(state);
  next.feedback = [];
  const recipePick = seededPick(next.rngState, availableCookingRecipes(next, action));
  next.rngState = recipePick.state;
  const recipe = recipePick.value;
  const roll = randomInt(next.rngState, 1, 100);
  next.rngState = roll.state;
  const chance = cookingSuccessChance(next);
  const success = roll.value <= chance;
  const useStoredWater = recipe.water > 0 && next.shelter.water >= recipe.water;
  const waterBottles = useStoredWater ? 0 : bottledWaterCost(recipe);
  const output = success ? recipe.output : 'scorched-meal';
  const reason = `${ITEM_MAP[output].name} · 料理`;

  next = applyEffect(next, {
    inventory: {
      ...cookingInventoryEffect(recipe, output),
      ...(waterBottles ? { 'water-bottle': -waterBottles } : {}),
    },
    shelter: {
      ...(action === 'gas-stove' ? { fuel: -recipe.energy } : { power: -recipe.energy }),
      ...(useStoredWater ? { water: -recipe.water } : {}),
    },
    stats: success ? { morale: 3 } : FAILED_COOKING_EFFECT,
  }, reason);

  const previousSkill = next.cookingSkill;
  next.cookingAttempts += 1;
  next.cookingSkill = Math.min(5, Math.floor(next.cookingAttempts / 3));
  if (next.cookingSkill > previousSkill) {
    next.feedback.push({ id: `${next.runId}-cooking-skill-${next.logs.length}`, label: '料理技能', delta: 1, reason: `累计尝试 ${next.cookingAttempts} 次` });
  }
  next.furniture[action].lastUsedDay = absoluteDay(next);

  const applianceName = action === 'gas-stove' ? '燃气炉' : action === 'microwave' ? '微波炉' : '电火锅';
  const waterText = recipe.water === 0 ? '这道料理不需要额外用水' : useStoredWater ? `使用储水 ${recipe.water}` : `使用瓶装水 ×${waterBottles}`;
  const skillText = next.cookingSkill > previousSkill ? `反复尝试让你的料理技能提升到 ${next.cookingSkill} 级。` : '';
  next.logs = [...next.logs, createLog(
    next,
    `${applianceName} · ${success ? recipe.name : '料理失手'}`,
    `${recipe.description}${waterText}。成功判定 ${roll.value}/${chance}：${success ? `完成${recipe.name}，成品已放入背包，可自行决定何时食用。` : '火候或比例出了问题，只得到一份勉强能吃的失败料理。'}当前料理技能 ${next.cookingSkill} 级，累计尝试 ${next.cookingAttempts} 次。${skillText}`,
    success ? 'good' : 'bad',
  )];
  return completeTimedAction(next, FURNITURE_ACTION_MINUTES[action], `furniture:${action}`);
}
