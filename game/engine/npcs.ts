import { NPC_BROADCAST_ORDER, NPC_MAP } from '../data/world.ts';
import type { GameState, NpcDefinition } from '../types.ts';

export function unlockedNpcIds(state: GameState): string[] {
  return NPC_BROADCAST_ORDER.slice(0, Math.min(state.broadcasts, NPC_BROADCAST_ORDER.length));
}

export function isNpcUnlocked(state: GameState, npcId: string): boolean {
  return unlockedNpcIds(state).includes(npcId);
}

export function nextBroadcastContact(state: GameState): NpcDefinition | undefined {
  const npcId = NPC_BROADCAST_ORDER[state.broadcasts];
  return npcId ? NPC_MAP[npcId] : undefined;
}
