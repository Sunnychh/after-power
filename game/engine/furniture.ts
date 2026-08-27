import { ITEM_MAP } from '../data/items.ts';
import { FAILED_COOKING_EFFECT, RECIPES_BY_APPLIANCE, type CookingApplianceId, type CookingRecipe } from '../data/recipes.ts';
import type { GameState, ItemDefinition } from '../types.ts';
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

const IMPROVISED_ENERGY: Record<FurnitureActionId, number> = {
  'gas-stove': 2,
  microwave: 2,
  'electric-hotpot': 3,
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

export function availableCookingIngredients(state: GameState): ItemDefinition[] {
  return Object.keys(state.inventory)
    .map((itemId) => ITEM_MAP[itemId])
    .filter((item): item is ItemDefinition => Boolean(
      item
      && item.category === '食物'
      && !item.tags?.includes('cooked')
      && inventoryCount(state.inventory, item.id) > 0,
    ))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function cookingSuccessChance(state: GameState): number {
  const difficultyAdjustment = state.difficulty === 'easy' ? 10 : state.difficulty === 'hard' ? -6 : 0;
  return clamp(58 + state.cookingSkill * 8 + difficultyAdjustment, 35, 96);
}

export function cookingPreview(state: GameState, action: FurnitureActionId): { recipes: number; ingredients: number; chance: number; improvisationChance: number; skill: number; attemptsToNext: number } {
  const chance = cookingSuccessChance(state);
  return {
    recipes: availableCookingRecipes(state, action).length,
    ingredients: availableCookingIngredients(state).length,
    chance,
    improvisationChance: clamp(chance - 22, 20, 74),
    skill: state.cookingSkill,
    attemptsToNext: state.cookingSkill >= 5 ? 0 : 3 - (state.cookingAttempts % 3),
  };
}

function energyDisabledReason(state: GameState, action: FurnitureActionId): string | null {
  const minimum = IMPROVISED_ENERGY[action];
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
  if (!availableCookingIngredients(state).length) return '背包里没有可投入的未烹饪食物';
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
  const completeRecipes = availableCookingRecipes(next, action);
  const richestIngredientCount = Math.max(0, ...completeRecipes.map((recipe) => Object.values(recipe.ingredients).reduce((sum, quantity) => sum + quantity, 0)));
  const preferredRecipes = completeRecipes.filter((recipe) => Object.values(recipe.ingredients).reduce((sum, quantity) => sum + quantity, 0) === richestIngredientCount);
  const recipePick = preferredRecipes.length ? seededPick(next.rngState, preferredRecipes) : undefined;
  if (recipePick) next.rngState = recipePick.state;
  const recipe = recipePick?.value;
  const ingredientPick = !recipe ? seededPick(next.rngState, availableCookingIngredients(next)) : undefined;
  if (ingredientPick) next.rngState = ingredientPick.state;
  const improvisedIngredient = ingredientPick?.value;
  const roll = randomInt(next.rngState, 1, 100);
  next.rngState = roll.state;
  const chance = recipe ? cookingSuccessChance(next) : clamp(cookingSuccessChance(next) - 22, 20, 74);
  const success = roll.value <= chance;
  const useStoredWater = Boolean(recipe && recipe.water > 0 && next.shelter.water >= recipe.water);
  const waterBottles = recipe && !useStoredWater ? bottledWaterCost(recipe) : 0;
  const improvisedDumplings = improvisedIngredient?.id === 'frozen-dumplings';
  const output = recipe
    ? success ? recipe.output : 'scorched-meal'
    : success ? improvisedDumplings ? 'dish-dry-dumplings' : 'dish-improvised-meal'
      : improvisedDumplings ? 'dish-scorched-dumplings' : 'scorched-meal';
  const reason = `${ITEM_MAP[output].name} · 料理`;
  const energy = recipe?.energy ?? IMPROVISED_ENERGY[action];
  const inventoryEffect = recipe
    ? cookingInventoryEffect(recipe, output)
    : { [output]: 1, [improvisedIngredient!.id]: -1 };

  next = applyEffect(next, {
    inventory: {
      ...inventoryEffect,
      ...(waterBottles ? { 'water-bottle': -waterBottles } : {}),
    },
    shelter: {
      ...(action === 'gas-stove' ? { fuel: -energy } : { power: -energy }),
      ...(useStoredWater && recipe ? { water: -recipe.water } : {}),
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
  const waterText = !recipe ? '没有凑齐完整配方，也没有强制补水' : recipe.water === 0 ? '这道料理不需要额外用水' : useStoredWater ? `使用储水 ${recipe.water}` : `使用瓶装水 ×${waterBottles}`;
  const skillText = next.cookingSkill > previousSkill ? `反复尝试让你的料理技能提升到 ${next.cookingSkill} 级。` : '';
  const cookingName = recipe ? recipe.name : `${improvisedIngredient!.name} · 即兴处理`;
  const cookingDescription = recipe?.description ?? `你只投入了${improvisedIngredient!.name}，仍然决定开火试试。`;
  const resultText = success
    ? `完成${ITEM_MAP[output].name}，成品已放入背包，可自行决定何时食用。`
    : improvisedDumplings ? '锅里没有水，水饺很快粘底裂开，只得到一份糊底水饺。' : '搭配和火候都不理想，只得到一份勉强能吃的失败料理。';
  next.logs = [...next.logs, createLog(
    next,
    `${applianceName} · ${success ? cookingName : '料理失手'}`,
    `${cookingDescription}${waterText}。${recipe ? '配方' : '即兴'}成功判定 ${roll.value}/${chance}：${resultText}当前料理技能 ${next.cookingSkill} 级，累计尝试 ${next.cookingAttempts} 次。${skillText}`,
    success ? 'good' : 'bad',
  )];
  return completeTimedAction(next, FURNITURE_ACTION_MINUTES[action], `furniture:${action}`);
}
