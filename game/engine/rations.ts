import { ITEMS } from '../data/items.ts';
import type { GameState, ItemDefinition } from '../types.ts';
import { inventoryCount, removeItem } from './inventory.ts';
import { applyFoodVariety, calculateFoodVariety } from './nutrition.ts';
import { applyEffect } from './state.ts';

export const AUTO_RATION_TARGET = 60;
export const STORAGE_WATER_HYDRATION = 7;

export function findAutoRation(state: GameState, tag: 'food' | 'water'): ItemDefinition | undefined {
  const stat = tag === 'food' ? 'satiety' : 'hydration';
  const deficit = Math.max(0, AUTO_RATION_TARGET - state.stats[stat]);
  return ITEMS
    .filter((item) => item.tags?.includes(tag) && (item.effects?.[stat] ?? 0) > 0 && inventoryCount(state.inventory, item.id) > 0)
    .sort((a, b) => {
      const aExpiry = Math.min(...(state.inventory[a.id] ?? []).map((batch) => batch.expiresOn ?? Infinity));
      const bExpiry = Math.min(...(state.inventory[b.id] ?? []).map((batch) => batch.expiresOn ?? Infinity));
      if (aExpiry !== bExpiry) return aExpiry - bExpiry;
      if (tag === 'food') {
        const boredomDifference = calculateFoodVariety(state, a).boredomDelta - calculateFoodVariety(state, b).boredomDelta;
        if (boredomDifference) return boredomDifference;
      }
      const reservePenalty = (item: ItemDefinition) => (item.tags?.includes('trade') ? 2 : 0) + (item.tags?.includes('ingredient') ? 1 : 0);
      const reserveDifference = reservePenalty(a) - reservePenalty(b);
      if (reserveDifference) return reserveDifference;
      const aRestore = a.effects?.[stat] ?? 0;
      const bRestore = b.effects?.[stat] ?? 0;
      return Math.abs(aRestore - deficit) - Math.abs(bRestore - deficit) || a.id.localeCompare(b.id);
    })[0];
}

export function consumeAutoRation(state: GameState, item: ItemDefinition, reason: string): { state: GameState; consumed: boolean; varietyText?: string } {
  const removed = removeItem(state.inventory, item.id, 1);
  if (!removed) return { state, consumed: false };
  let next = { ...structuredClone(state), inventory: removed };
  next = applyEffect(next, { stats: item.effects }, reason);
  let varietyText: string | undefined;
  if (item.tags?.includes('food')) {
    const variety = applyFoodVariety(next, item);
    next = variety.state;
    varietyText = `${variety.message} 饮食厌倦 ${next.foodBoredom}/100。`;
  }
  next.feedback.push({ id: `${next.runId}-ration-${next.logs.length}-${item.id}`, label: item.name, delta: -1, reason });
  return { state: next, consumed: true, varietyText };
}

export function topUpFromStoredWater(state: GameState, reason: string): { state: GameState; used: number } {
  if (state.stats.hydration >= AUTO_RATION_TARGET || state.shelter.water < 1) return { state, used: 0 };
  const used = Math.min(
    state.shelter.water,
    Math.max(1, Math.ceil((AUTO_RATION_TARGET - state.stats.hydration) / STORAGE_WATER_HYDRATION)),
  );
  return {
    state: applyEffect(state, { shelter: { water: -used }, stats: { hydration: used * STORAGE_WATER_HYDRATION } }, reason),
    used,
  };
}

/** Dry-run the exact ration selection order for UI warnings. */
export function forecastAutomaticRations(state: GameState, satiety: number, hydration: number): GameState {
  let next = structuredClone(state);
  next.stats.satiety = satiety;
  next.stats.hydration = hydration;
  for (let guard = 0; guard < 8 && next.stats.satiety < AUTO_RATION_TARGET; guard += 1) {
    const food = findAutoRation(next, 'food');
    if (!food) break;
    const ration = consumeAutoRation(next, food, '自动配给预演');
    if (!ration.consumed) break;
    next = ration.state;
  }
  for (let guard = 0; guard < 8 && next.stats.hydration < AUTO_RATION_TARGET; guard += 1) {
    const water = findAutoRation(next, 'water');
    if (!water) break;
    const ration = consumeAutoRation(next, water, '自动配给预演');
    if (!ration.consumed) break;
    next = ration.state;
  }
  return topUpFromStoredWater(next, '自动配给预演 · 水箱').state;
}
