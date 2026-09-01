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
export type CookingWaterSource = 'none' | 'shelter' | 'bottle' | 'auto';

export interface CookingSelectionInsight {
  status: 'empty' | 'known' | 'unknown' | 'risky';
  label: string;
  chance?: number;
}

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

function hasRecipeWater(state: GameState, recipe: CookingRecipe, source: CookingWaterSource = 'auto'): boolean {
  if (recipe.water === 0) return source === 'none' || source === 'auto';
  if (source === 'none') return false;
  if (source === 'shelter') return state.shelter.water >= recipe.water;
  if (source === 'bottle') return inventoryCount(state.inventory, 'water-bottle') >= bottledWaterCost(recipe);
  return state.shelter.water >= recipe.water || inventoryCount(state.inventory, 'water-bottle') >= bottledWaterCost(recipe);
}

function hasRecipeIngredients(state: GameState, recipe: CookingRecipe): boolean {
  return Object.entries(recipe.ingredients).every(([itemId, quantity]) => inventoryCount(state.inventory, itemId) >= quantity);
}

function matchesSelectedIngredients(recipe: CookingRecipe, selectedIngredientIds: string[]): boolean {
  const required = Object.entries(recipe.ingredients).flatMap(([itemId, quantity]) => Array(quantity).fill(itemId)).sort();
  const selected = [...selectedIngredientIds].sort();
  return required.length === selected.length && required.every((itemId, index) => itemId === selected[index]);
}

function selectedRecipeDefinition(action: FurnitureActionId, selectedIngredientIds: string[]): CookingRecipe | undefined {
  return RECIPES_BY_APPLIANCE[action].find((candidate) => matchesSelectedIngredients(candidate, selectedIngredientIds));
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
      && (item.category === '食物' || item.tags?.includes('cookable'))
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

/**
 * Gives the player a useful risk read without leaking an undiscovered recipe.
 * Only recipes already cooked successfully are named; every other selection remains unknown.
 */
export function cookingSelectionInsight(state: GameState, action: FurnitureActionId, ingredientIds: string[], waterSource: CookingWaterSource = 'auto'): CookingSelectionInsight {
  if (!ingredientIds.length) return { status: 'empty', label: '等待选择食材' };
  const chance = cookingSuccessChance(state);
  const recipe = selectedRecipeDefinition(action, ingredientIds);
  if (!recipe) {
    const improvisationChance = clamp(chance - 22 + Math.max(0, ingredientIds.length - 1) * 3, 20, 80);
    return { status: 'risky', label: `未知结果 · 失败可能性较大（即兴成功约 ${improvisationChance}%）`, chance: improvisationChance };
  }
  const hasEnergy = action === 'gas-stove' ? state.shelter.fuel >= recipe.energy : state.shelter.power >= recipe.energy;
  const hasWater = hasRecipeWater(state, recipe, waterSource);
  if (!hasEnergy || !hasWater) {
    const improvisationChance = clamp(chance - 22 + Math.max(0, ingredientIds.length - 1) * 3, 20, 80);
    const shortages = [
      !hasEnergy ? `${action === 'gas-stove' ? '燃料' : '电力'}不足完整火候` : '',
      !hasWater ? recipe.water > 0 && waterSource === 'none' ? '尚未选择用水' : '可用水不足，所选水源无法完成做法' : '',
    ].filter(Boolean).join('、');
    if (state.discoveredRecipes.includes(recipe.id)) {
      return { status: 'known', label: `已掌握 · ${recipe.name}；${shortages}，本次只能即兴尝试（成功约 ${improvisationChance}%）`, chance: improvisationChance };
    }
    return { status: 'risky', label: `未知结果 · 搭配似乎有章法，但${shortages}，失败可能性较大（即兴成功约 ${improvisationChance}%）`, chance: improvisationChance };
  }
  if (state.discoveredRecipes.includes(recipe.id)) {
    return { status: 'known', label: `已掌握 · ${recipe.name}（成功约 ${chance}%）`, chance };
  }
  return { status: 'unknown', label: `未知结果 · 搭配看起来有些章法（成功约 ${chance}%）`, chance };
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

export function selectedCookingDisabledReason(state: GameState, action: FurnitureActionId, ingredientIds: string[], waterSource: CookingWaterSource = 'auto'): string | null {
  const base = furnitureActionDisabledReason(state, action);
  if (base) return base;
  if (!ingredientIds.length) return '至少选择一种食材';
  if (new Set(ingredientIds).size !== ingredientIds.length) return '同一种食材每次最多投入一份';
  const available = new Set(availableCookingIngredients(state).map((item) => item.id));
  const unavailable = ingredientIds.find((itemId) => !available.has(itemId));
  if (unavailable) return `${ITEM_MAP[unavailable]?.name ?? unavailable} 当前不可投入`;
  const recipe = selectedRecipeDefinition(action, ingredientIds);
  if (recipe && recipe.water > 0 && waterSource !== 'none' && !hasRecipeWater(state, recipe, waterSource)) {
    return waterSource === 'shelter' ? `储水器净水不足 ${recipe.water}` : `瓶装水不足 ${bottledWaterCost(recipe)} 瓶`;
  }
  if (waterSource === 'shelter' && state.shelter.water < 1) return '储水器已经没有可用净水';
  if (waterSource === 'bottle' && inventoryCount(state.inventory, 'water-bottle') < 1) return '背包里没有瓶装水';
  return null;
}

function cookingInventoryEffect(recipe: CookingRecipe, output: string): Record<string, number> {
  const inventory: Record<string, number> = { [output]: 1 };
  for (const [itemId, quantity] of Object.entries(recipe.ingredients)) inventory[itemId] = -quantity;
  return inventory;
}

export function performFurnitureAction(state: GameState, action: FurnitureActionId, selectedIngredientIds?: string[], selectedWaterSource: CookingWaterSource = 'auto'): EngineResult {
  const disabled = selectedIngredientIds
    ? selectedCookingDisabledReason(state, action, selectedIngredientIds, selectedWaterSource)
    : furnitureActionDisabledReason(state, action);
  if (disabled) return { state, ok: false, message: disabled };

  let next = structuredClone(state);
  next.feedback = [];
  const completeRecipes = availableCookingRecipes(next, action);
  const richestIngredientCount = Math.max(0, ...completeRecipes.map((recipe) => Object.values(recipe.ingredients).reduce((sum, quantity) => sum + quantity, 0)));
  const preferredRecipes = completeRecipes.filter((recipe) => Object.values(recipe.ingredients).reduce((sum, quantity) => sum + quantity, 0) === richestIngredientCount);
  const selected = selectedIngredientIds ? [...selectedIngredientIds].sort() : undefined;
  const selectedCandidate = selected ? selectedRecipeDefinition(action, selected) : undefined;
  const selectedRecipe = selectedCandidate && hasRecipeWater(next, selectedCandidate, selectedWaterSource) ? selectedCandidate : undefined;
  const recipePick = !selected && preferredRecipes.length ? seededPick(next.rngState, preferredRecipes) : undefined;
  if (recipePick) next.rngState = recipePick.state;
  const recipe = selectedRecipe ?? recipePick?.value;
  const ingredientPick = !selected && !recipe ? seededPick(next.rngState, availableCookingIngredients(next)) : undefined;
  if (ingredientPick) next.rngState = ingredientPick.state;
  const improvisedIngredients = recipe
    ? []
    : selected
      ? selected.map((itemId) => ITEM_MAP[itemId]).filter((item): item is ItemDefinition => Boolean(item))
      : ingredientPick?.value ? [ingredientPick.value] : [];
  const roll = randomInt(next.rngState, 1, 100);
  next.rngState = roll.state;
  const chance = recipe ? cookingSuccessChance(next) : clamp(cookingSuccessChance(next) - 22 + Math.max(0, improvisedIngredients.length - 1) * 3, 20, 80);
  const success = roll.value <= chance;
  const useStoredWater = Boolean(recipe && recipe.water > 0 && (selectedWaterSource === 'shelter' || (selectedWaterSource === 'auto' && next.shelter.water >= recipe.water)));
  const waterBottles = recipe && recipe.water > 0 && !useStoredWater ? bottledWaterCost(recipe) : 0;
  const improvisedStoredWater = !recipe && selectedWaterSource === 'shelter' ? 1 : 0;
  const improvisedWaterBottle = !recipe && selectedWaterSource === 'bottle' ? 1 : 0;
  const improvisedDumplings = improvisedIngredients.length === 1 && improvisedIngredients[0]?.id === 'frozen-dumplings';
  const output = recipe
    ? success ? recipe.output : 'scorched-meal'
    : success ? improvisedDumplings ? 'dish-dry-dumplings' : 'dish-improvised-meal'
      : improvisedDumplings ? 'dish-scorched-dumplings' : 'scorched-meal';
  const reason = `${ITEM_MAP[output].name} · 料理`;
  const energy = recipe?.energy ?? IMPROVISED_ENERGY[action];
  const inventoryEffect = recipe
    ? cookingInventoryEffect(recipe, output)
    : { [output]: 1, ...Object.fromEntries(improvisedIngredients.map((ingredient) => [ingredient.id, -1])) };

  next = applyEffect(next, {
    inventory: {
      ...inventoryEffect,
      ...(waterBottles ? { 'water-bottle': -waterBottles } : {}),
      ...(improvisedWaterBottle ? { 'water-bottle': -1 } : {}),
    },
    shelter: {
      ...(action === 'gas-stove' ? { fuel: -energy } : { power: -energy }),
      ...(useStoredWater && recipe ? { water: -recipe.water } : {}),
      ...(improvisedStoredWater ? { water: -1 } : {}),
    },
    stats: success ? { morale: 3 } : FAILED_COOKING_EFFECT,
  }, reason);

  const recipeWasKnown = Boolean(recipe && state.discoveredRecipes.includes(recipe.id));
  const previousSkill = next.cookingSkill;
  next.cookingAttempts += 1;
  next.cookingSkill = Math.min(5, Math.floor(next.cookingAttempts / 3));
  if (next.cookingSkill > previousSkill) {
    next.feedback.push({ id: `${next.runId}-cooking-skill-${next.logs.length}`, label: '料理技能', delta: 1, reason: `累计尝试 ${next.cookingAttempts} 次` });
  }
  next.furniture[action].lastUsedDay = absoluteDay(next);
  if (recipe && success && !next.discoveredRecipes.includes(recipe.id)) {
    next.discoveredRecipes.push(recipe.id);
    next.feedback.push({ id: `${next.runId}-recipe-${recipe.id}`, label: '新配方', delta: 1, reason: recipe.name });
  }

  const applianceName = action === 'gas-stove' ? '燃气炉' : action === 'microwave' ? '微波炉' : '电火锅';
  const waterText = !recipe
    ? selectedWaterSource === 'shelter' ? '从储水器加入净水 1' : selectedWaterSource === 'bottle' ? '加入瓶装水 ×1' : '没有加入水'
    : recipe.water === 0 ? '这道料理不需要额外用水' : useStoredWater ? `从储水器加入净水 ${recipe.water}` : `加入瓶装水 ×${waterBottles}`;
  const skillText = next.cookingSkill > previousSkill ? `反复尝试让你的料理技能提升到 ${next.cookingSkill} 级。` : '';
  const usedIngredientIds = recipe
    ? Object.entries(recipe.ingredients).flatMap(([itemId, quantity]) => Array(quantity).fill(itemId))
    : improvisedIngredients.map((ingredient) => ingredient.id);
  const ingredientNames = usedIngredientIds.map((itemId) => ITEM_MAP[itemId]?.name ?? itemId).join('、');
  const revealRecipe = Boolean(recipe && (success || recipeWasKnown));
  const cookingName = revealRecipe && recipe ? recipe.name : `${ingredientNames} · ${recipe ? '未知组合' : '即兴处理'}`;
  const cookingDescription = revealRecipe && recipe
    ? recipe.description
    : `你把${ingredientNames}放在一起，没有可以照抄的记录，只能凭气味、火候和经验判断。`;
  const resultText = success
    ? `完成${ITEM_MAP[output].name}，成品已放入背包，可自行决定何时食用。`
    : improvisedDumplings ? '锅里没有水，水饺很快粘底裂开，只得到一份糊底水饺。' : '搭配和火候都不理想，只得到一份勉强能吃的失败料理。';
  next.logs = [...next.logs, createLog(
    next,
    `${applianceName} · ${success ? cookingName : '料理失手'}`,
    `${cookingDescription}${waterText}。${revealRecipe ? '已掌握做法' : recipe ? '未知组合' : '即兴'}成功判定 ${roll.value}/${chance}：${resultText}${recipe && success ? `“${recipe.name}”已写入配方图鉴。` : ''}当前料理技能 ${next.cookingSkill} 级，累计尝试 ${next.cookingAttempts} 次。${skillText}`,
    success ? 'good' : 'bad',
  )];
  return completeTimedAction(next, FURNITURE_ACTION_MINUTES[action], `furniture:${action}`);
}
