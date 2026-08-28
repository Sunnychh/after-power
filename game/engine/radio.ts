import type { EventEffect, GameState } from '../types.ts';
import { inventoryCount } from './inventory.ts';

export type RadioUsePurpose = 'event' | 'listen';

export interface RadioUseMethod {
  source: 'power' | 'battery' | 'hand-crank';
  label: string;
  minutes: number;
  effect: EventEffect;
}

/** A single source of truth for whether the player's radio can actually operate. */
export function radioUseMethod(state: GameState, purpose: RadioUsePurpose): RadioUseMethod | null {
  if (inventoryCount(state.inventory, 'radio') < 1) return null;
  const powerCost = purpose === 'listen' ? 2 : 1;
  const staminaCost = purpose === 'listen' ? 12 : 8;
  if (state.shelter.power >= powerCost) {
    return { source: 'power', label: `备用电力 -${powerCost}`, minutes: purpose === 'listen' ? 60 : 0, effect: { shelter: { power: -powerCost } } };
  }
  if (inventoryCount(state.inventory, 'batteries') >= 1) {
    return { source: 'battery', label: '电池组 -1', minutes: purpose === 'listen' ? 60 : 0, effect: { inventory: { batteries: -1 } } };
  }
  if (state.stats.stamina > staminaCost) {
    return { source: 'hand-crank', label: `手摇供电，体力 -${staminaCost}`, minutes: purpose === 'listen' ? 120 : 0, effect: { stats: { stamina: -staminaCost } } };
  }
  return null;
}

export function radioUseDisabledReason(state: GameState, purpose: RadioUsePurpose): string | null {
  if (inventoryCount(state.inventory, 'radio') < 1) return '缺少短波收音机';
  if (radioUseMethod(state, purpose)) return null;
  return `没有可用电力或电池，体力也不足以手摇供电（需要高于 ${purpose === 'listen' ? 12 : 8}）`;
}
