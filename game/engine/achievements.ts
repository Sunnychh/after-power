import { ACHIEVEMENTS, ACHIEVEMENT_MAP, type AchievementDefinition } from '../data/achievements.ts';
import { LOCATIONS, NPCS } from '../data/world.ts';
import { ITEM_MAP } from '../data/items.ts';
import type { AchievementId, GameState, MetaState, OutcomeId } from '../types.ts';
import { inventoryCount } from './inventory.ts';

export interface AchievementProgress {
  current: number;
  target: number;
  complete: boolean;
}

function knownEndings(meta: MetaState, state: GameState | null): OutcomeId[] {
  return [...new Set([
    ...meta.endings,
    ...(state?.outcome ? [state.outcome.id] : []),
  ])];
}

function rawProgress(id: AchievementId, state: GameState | null, meta: MetaState): number {
  if (!state && !id.startsWith('ending-')) return 0;
  switch (id) {
    case 'first-night':
      return state!.survivalDay >= 2 ? 1 : 0;
    case 'district-scout':
    case 'city-cartographer':
      return LOCATIONS.filter((location) => (state!.visited[location.id] ?? 0) > 0).length;
    case 'field-specialist':
      return Math.max(0, ...Object.values(state!.explorationSkills).map((skill) => skill.level));
    case 'first-recipe':
    case 'recipe-collector':
    case 'recipe-master':
      return new Set(state!.discoveredRecipes).size;
    case 'pantry-variety':
      return Object.values(ITEM_MAP).filter((item) => (item.category === '食物' || item.category === '饮水') && inventoryCount(state!.inventory, item.id) > 0).length;
    case 'shelter-ready':
      return state!.shelter.integrity >= 90 && state!.shelter.reinforcement >= 2 ? 1 : 0;
    case 'all-rounder':
      return Object.values(state!.explorationSkills).filter((skill) => skill.level >= 2).length;
    case 'broadcast-circle':
      return state!.broadcasts;
    case 'long-haul':
      return state!.phase !== 'prep' ? state!.survivalDay : 0;
    case 'seasoned-cook':
      return state!.cookingSkill;
    case 'first-alliance':
    case 'full-coalition':
      return NPCS.filter((npc) => state!.flags.includes(`npc-allied:${npc.id}`)).length;
    case 'live-wire':
      return state!.difficulty === 'hard' ? state!.powerTrap.level : 0;
    case 'hard-survivor':
      return state!.difficulty === 'hard' && state!.outcome && state!.outcome.id !== 'death' ? 1 : 0;
    case 'ending-death':
      return knownEndings(meta, state).includes('death') ? 1 : 0;
    case 'ending-survivor':
      return knownEndings(meta, state).includes('survivor') ? 1 : 0;
    case 'ending-truth':
      return knownEndings(meta, state).includes('truth') ? 1 : 0;
    case 'ending-collection':
      return knownEndings(meta, state).length;
  }
}

export function achievementProgress(id: AchievementId, state: GameState | null, meta: MetaState): AchievementProgress {
  const target = ACHIEVEMENT_MAP[id].target;
  if (meta.achievements.includes(id)) return { current: target, target, complete: true };
  const current = Math.min(target, Math.max(0, rawProgress(id, state, meta)));
  return { current, target, complete: current >= target };
}

export function evaluateAchievements(meta: MetaState, state: GameState | null): { meta: MetaState; unlocked: AchievementDefinition[] } {
  const unlocked: AchievementDefinition[] = [];
  const next: MetaState = {
    ...structuredClone(meta),
    achievements: [...new Set(meta.achievements)].filter((id) => Object.hasOwn(ACHIEVEMENT_MAP, id)),
  };
  for (const achievement of ACHIEVEMENTS) {
    if (next.achievements.includes(achievement.id)) continue;
    if (rawProgress(achievement.id, state, next) < achievement.target) continue;
    next.achievements.push(achievement.id);
    unlocked.push(achievement);
  }
  return { meta: next, unlocked };
}
