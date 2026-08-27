import type { GameState, ItemDefinition } from '../types.ts';
import { clamp } from './state.ts';

export interface FoodVarietyResult {
  state: GameState;
  message: string;
  boredomDelta: number;
  moraleDelta: number;
}

/** Applies the same meal-variety rules to manual eating and automatic rations. */
export function applyFoodVariety(state: GameState, item: ItemDefinition): FoodVarietyResult {
  if (!item.tags?.includes('food')) return { state, message: '', boredomDelta: 0, moraleDelta: 0 };

  const next = structuredClone(state);
  const history = Array.isArray(next.recentMeals) ? next.recentMeals : [];
  let consecutive = 0;
  for (let index = history.length - 1; index >= 0 && history[index] === item.id; index -= 1) consecutive += 1;
  const recentUses = history.slice(-4).filter((itemId) => itemId === item.id).length;
  const cooked = item.tags.includes('cooked') && !item.tags.includes('failed');
  const beforeBoredom = Number.isFinite(next.foodBoredom) ? next.foodBoredom : 0;
  let boredomChange = 0;
  let moralePenalty = 0;
  let message = '';

  if (consecutive > 0) {
    boredomChange = cooked ? Math.min(12, 3 + consecutive * 3) : Math.min(30, 10 + consecutive * 5);
    moralePenalty = cooked
      ? Math.min(7, 1 + consecutive * 2)
      : Math.min(14, 2 + consecutive * 3 + Math.floor(beforeBoredom / 30));
    message = cooked
      ? `连续第 ${consecutive + 1} 次吃${item.name}，即使是热食也开始重复。`
      : `连续第 ${consecutive + 1} 次吃${item.name}，熟悉的味道已经令人厌倦。`;
  } else if (state.difficulty === 'hard' && recentUses > 0) {
    boredomChange = cooked ? 3 : 8;
    moralePenalty = cooked ? 1 : 2 + Math.floor(beforeBoredom / 40);
    message = cooked
      ? `${item.name}虽然隔餐再吃，艰难环境里的有限菜单仍让它显得重复。`
      : `${item.name}在最近四餐里已经出现过；交替口粮仍无法掩盖长期单调。`;
  } else if (recentUses >= 2) {
    boredomChange = cooked ? -8 : 4;
    moralePenalty = cooked ? 0 : 1;
    message = cooked ? `${item.name}重新端上桌，热食仍缓解了一些厌倦。` : `${item.name}最近出现得太频繁，换着吃也只能稍作缓解。`;
  } else {
    boredomChange = cooked ? -24 : -8;
    message = cooked
      ? beforeBoredom > 0 ? '一份不同的热食让日子重新有了味道。' : '这份热食没有重复最近的口味。'
      : beforeBoredom > 0 ? '换了一种口粮，饮食厌倦有所缓解。' : '这次口粮没有重复最近的选择。';
  }

  next.foodBoredom = clamp(beforeBoredom + boredomChange);
  const actualBoredomDelta = next.foodBoredom - beforeBoredom;
  const beforeMorale = next.stats.morale;
  next.stats.morale = clamp(next.stats.morale - moralePenalty);
  const actualMoraleDelta = next.stats.morale - beforeMorale;
  next.recentMeals = [...history, item.id].slice(-6);
  if (actualBoredomDelta) next.feedback.push({
    id: `${next.runId}-food-boredom-${next.logs.length}-${next.recentMeals.length}`,
    label: '饮食厌倦', delta: actualBoredomDelta, reason: item.name,
  });
  if (actualMoraleDelta) next.feedback.push({
    id: `${next.runId}-food-morale-${next.logs.length}-${next.recentMeals.length}`,
    label: '精神', delta: actualMoraleDelta, reason: '重复饮食',
  });
  return { state: next, message, boredomDelta: actualBoredomDelta, moraleDelta: actualMoraleDelta };
}

export function foodVarietyPreview(state: GameState, item: ItemDefinition): string | null {
  if (!item.tags?.includes('food')) return null;
  const history = state.recentMeals ?? [];
  let consecutive = 0;
  for (let index = history.length - 1; index >= 0 && history[index] === item.id; index -= 1) consecutive += 1;
  if (state.difficulty === 'hard' && consecutive === 0 && history.slice(-4).includes(item.id)) return '艰难模式：最近四餐已吃过，再次食用仍会增加厌倦';
  if (consecutive === 0) return item.tags.includes('cooked') && !item.tags.includes('failed') ? '不同料理可大幅降低厌倦' : '更换口味可降低厌倦';
  return `已连续吃 ${consecutive} 次；再次食用会增加厌倦并削减精神收益`;
}
