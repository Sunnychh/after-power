import { ITEM_MAP } from '../data/items.ts';
import type { GameState, ItemDefinition } from '../types.ts';
import { clamp, hasFlag } from './state.ts';

export interface FoodVarietyForecast {
  boredomDelta: number;
  moralePenalty: number;
  fatigueGain: number;
  familyFatigueGain: number;
  personalFatigue: number;
  familyFatigue: number;
  recentUses: number;
  consecutive: number;
  message: string;
}

export interface FoodVarietyResult extends FoodVarietyForecast {
  state: GameState;
  moraleDelta: number;
}

const FAMILY_BY_ID: Record<string, string> = {
  crackers: '干粮',
  'instant-noodles': '面食',
  oats: '谷物',
  'milk-powder': '乳谷',
  'canned-beans': '豆类',
  jerky: '咸味蛋白',
  'luncheon-meat': '咸味蛋白',
  chocolate: '甜食',
  'fresh-apples': '果蔬',
  'tomato-can': '果蔬',
};

/** A broad flavour/texture family catches "different name, same kind of meal" repetition. */
export function foodFamily(item: ItemDefinition): string {
  if (FAMILY_BY_ID[item.id]) return FAMILY_BY_ID[item.id];
  if (item.id.includes('dumpling')) return '面点';
  if (item.id.includes('noodles')) return '面食';
  if (item.id.includes('congee') || item.id.includes('oatmeal')) return '谷物糊粥';
  if (item.id.includes('broth') || item.id.includes('hotpot') || item.id.includes('stew')) return '汤炖';
  if (item.id.includes('potato') || item.id.includes('flatbread')) return '淀粉热食';
  if (item.id.includes('bean') || item.id.includes('meat')) return '咸味蛋白';
  if (item.tags?.includes('failed')) return '失败料理';
  if (item.tags?.includes('improvised')) return '杂烩';
  if (item.tags?.includes('cooked')) return '热食';
  return item.tags?.includes('fresh') ? '果蔬' : '耐储口粮';
}

function positiveMultiplier(state: GameState): number {
  return state.difficulty === 'easy' ? 0.78 : state.difficulty === 'hard' ? 1.25 : 1;
}

function fatigueGainFor(state: GameState, item: ItemDefinition): number {
  const cooked = item.tags?.includes('cooked') && !item.tags.includes('failed');
  const base = item.tags?.includes('failed') ? 16 : cooked ? 7 : 12;
  return Math.max(1, Math.round(base * positiveMultiplier(state)));
}

function familyFatigueGainFor(state: GameState, item: ItemDefinition): number {
  const cooked = item.tags?.includes('cooked') && !item.tags.includes('failed');
  const base = item.tags?.includes('failed') ? 10 : cooked ? 4 : 7;
  return Math.max(1, Math.round(base * positiveMultiplier(state)));
}

/** Pure forecast used by manual eating, automatic rations and inventory hints. */
export function calculateFoodVariety(state: GameState, item: ItemDefinition): FoodVarietyForecast {
  if (!item.tags?.includes('food')) {
    return { boredomDelta: 0, moralePenalty: 0, fatigueGain: 0, familyFatigueGain: 0, personalFatigue: 0, familyFatigue: 0, recentUses: 0, consecutive: 0, message: '' };
  }

  const history = Array.isArray(state.recentMeals) ? state.recentMeals.slice(-10) : [];
  const personalFatigue = clamp(state.foodFatigue?.[item.id] ?? 0);
  let consecutive = 0;
  for (let index = history.length - 1; index >= 0 && history[index] === item.id; index -= 1) consecutive += 1;
  const recentUses = history.slice(-6).filter((itemId) => itemId === item.id).length;
  const distinctRecent = new Set(history.slice(-6)).size;
  const family = foodFamily(item);
  const familyFatigue = clamp(state.foodFamilyFatigue?.[family] ?? 0);
  const familyUses = history.slice(-6).filter((itemId) => ITEM_MAP[itemId] && foodFamily(ITEM_MAP[itemId]) === family).length;
  const cooked = item.tags.includes('cooked') && !item.tags.includes('failed');
  const failed = item.tags.includes('failed');
  const fresh = item.tags.includes('fresh');
  const eatenFoodIds = Array.isArray(state.eatenFoodIds) ? state.eatenFoodIds : [];
  const trulyNovel = !eatenFoodIds.includes(item.id) && personalFatigue === 0 && recentUses === 0;

  let rawChange: number;
  if (failed) {
    const burden = 8
      + recentUses * 2
      + Math.floor(personalFatigue / 25) * 2
      + Math.floor(familyFatigue / 20) * 2
      + consecutive * 3
      + Math.floor(familyUses / 2);
    rawChange = Math.max(6, Math.round(burden * positiveMultiplier(state)));
  } else if (trulyNovel) {
    const relief = cooked ? -10 : fresh ? -5 : -3;
    const sameFamilyBurden = Math.max(0, familyUses - 1) * 2 + Math.floor(familyFatigue / 12) * 2;
    rawChange = Math.min(2, relief + sameFamilyBurden);
  } else {
    const narrowMenu = Math.max(0, 3 - distinctRecent);
    const burden = 1
      + recentUses * 2
      + Math.floor(personalFatigue / 25) * 2
      + consecutive * 3
      + Math.floor(familyUses / 2)
      + Math.floor(familyFatigue / 25) * 2
      + narrowMenu;
    rawChange = Math.max(1, Math.round(burden * (cooked ? 0.65 : 1) * positiveMultiplier(state)));
  }

  const message = failed
    ? `${item.name}的焦糊、生硬或失败口感不会提供新鲜感，反而加重进食压力。`
    : trulyNovel && rawChange < 0
      ? cooked
        ? `第一次吃${item.name}；新的热食能缓解单调，但不会抹去对其他食物的长期厌倦。`
        : fresh
          ? `${item.name}带来一种真正新的口感，饮食厌倦有限缓解。`
          : `第一次吃${item.name}，菜单得到小幅变化。`
      : trulyNovel
        ? rawChange > 0
          ? `${item.name}虽是新做法，但你对“${family}”这类口感已经疲倦，这次换名字也没能缓解厌倦。`
          : `${item.name}是新做法，但同类口感的疲倦抵消了新鲜感。`
        : consecutive > 0
          ? `连续第 ${consecutive + 1} 次吃${item.name}，熟悉感和单调菜单叠加。`
          : `${item.name}虽然隔餐再吃，单品与同类口感的熟悉度仍在；交替少数食物不能重置厌倦。`;

  const boredomDelta = clamp(state.foodBoredom + rawChange) - state.foodBoredom;
  const projected = clamp(state.foodBoredom + boredomDelta);
  let moralePenalty = rawChange <= 0 ? 0 : projected >= 90 ? 9 : projected >= 75 ? 6 : projected >= 60 ? 3 : projected >= 40 ? 1 : 0;
  if (state.difficulty === 'easy') moralePenalty = Math.max(0, moralePenalty - 1);
  if (hasFlag(state, 'ability:steady')) moralePenalty = Math.max(0, moralePenalty - 1);

  return {
    boredomDelta,
    moralePenalty,
    fatigueGain: fatigueGainFor(state, item),
    familyFatigueGain: familyFatigueGainFor(state, item),
    personalFatigue,
    familyFatigue,
    recentUses,
    consecutive,
    message,
  };
}

/** Applies the same persistent meal-variety rules to manual eating and automatic rations. */
export function applyFoodVariety(state: GameState, item: ItemDefinition): FoodVarietyResult {
  const forecast = calculateFoodVariety(state, item);
  if (!item.tags?.includes('food')) return { state, ...forecast, moraleDelta: 0 };

  const next = structuredClone(state);
  const history = Array.isArray(next.recentMeals) ? next.recentMeals : [];
  const beforeBoredom = next.foodBoredom;
  const beforeMorale = next.stats.morale;
  next.foodFatigue = { ...(next.foodFatigue ?? {}) };
  next.foodFamilyFatigue = { ...(next.foodFamilyFatigue ?? {}) };
  next.eatenFoodIds = Array.isArray(next.eatenFoodIds) ? [...next.eatenFoodIds] : [];
  next.foodFatigue[item.id] = clamp((next.foodFatigue[item.id] ?? 0) + forecast.fatigueGain);
  const family = foodFamily(item);
  next.foodFamilyFatigue[family] = clamp((next.foodFamilyFatigue[family] ?? 0) + forecast.familyFatigueGain);
  if (!next.eatenFoodIds.includes(item.id)) next.eatenFoodIds.push(item.id);
  next.foodBoredom = clamp(next.foodBoredom + forecast.boredomDelta);
  next.stats.morale = clamp(next.stats.morale - forecast.moralePenalty);
  next.recentMeals = [...history, item.id].slice(-10);
  const actualBoredomDelta = next.foodBoredom - beforeBoredom;
  const actualMoraleDelta = next.stats.morale - beforeMorale;

  if (actualBoredomDelta) next.feedback.push({
    id: `${next.runId}-food-boredom-${next.logs.length}-${next.recentMeals.length}`,
    label: '饮食厌倦', delta: actualBoredomDelta, reason: item.name,
  });
  if (actualMoraleDelta) next.feedback.push({
    id: `${next.runId}-food-morale-${next.logs.length}-${next.recentMeals.length}`,
    label: '精神', delta: actualMoraleDelta, reason: '饮食单调',
  });
  return { state: next, ...forecast, boredomDelta: actualBoredomDelta, moraleDelta: actualMoraleDelta };
}

/** Familiarity fades a little overnight; it never vanishes because one different meal was eaten. */
export function recoverFoodFatigue(state: GameState): { state: GameState; boredomRecovered: number } {
  const next = structuredClone(state);
  const fatigueRecovery = next.difficulty === 'easy' ? 4 : next.difficulty === 'hard' ? 2 : 3;
  const familyRecovery = next.difficulty === 'easy' ? 3 : next.difficulty === 'hard' ? 1 : 2;
  next.foodFatigue = Object.fromEntries(Object.entries(next.foodFatigue ?? {})
    .map(([itemId, value]) => [itemId, Math.max(0, value - fatigueRecovery)] as const)
    .filter(([, value]) => value > 0));
  next.foodFamilyFatigue = Object.fromEntries(Object.entries(next.foodFamilyFatigue ?? {})
    .map(([family, value]) => [family, Math.max(0, value - familyRecovery)] as const)
    .filter(([, value]) => value > 0));
  const globalRecovery = next.difficulty === 'easy' ? 2 : 1;
  const before = next.foodBoredom;
  next.foodBoredom = Math.max(0, next.foodBoredom - globalRecovery);
  return { state: next, boredomRecovered: before - next.foodBoredom };
}

export function foodVarietyPreview(state: GameState, item: ItemDefinition): string | null {
  if (!item.tags?.includes('food')) return null;
  const forecast = calculateFoodVariety(state, item);
  const deltaText = forecast.boredomDelta > 0
    ? `预计厌倦 +${forecast.boredomDelta}`
    : forecast.boredomDelta < 0
      ? `预计厌倦 ${forecast.boredomDelta}`
      : '预计厌倦不变';
  return `${deltaText} · 单品熟悉 ${forecast.personalFatigue}/100 · 同类疲劳 ${forecast.familyFatigue}/100。${forecast.message}`;
}
