import type { DeepLocation, DeepScene } from '../data/deep-exploration.ts';
import { DEEP_LOCATIONS } from '../data/deep-exploration.ts';
import type { GameState } from '../types.ts';
import { isDeepTargetResolved } from './deep-exploration.ts';

export type DeepMapNodeStatus = 'current' | 'adjacent' | 'discovered' | 'unknown';

export interface DeepMapLayoutNode {
  sceneId: string;
  depth: number;
  order: number;
  parentId?: string;
}

export interface DeepMapLayout {
  locationId: string;
  entranceId: string;
  nodes: DeepMapLayoutNode[];
  layers: string[][];
}

export interface DeepMapNodeSummary extends DeepMapLayoutNode {
  name: string;
  status: DeepMapNodeStatus;
  isEntrance: boolean;
  connections: string[];
  processedTargets: number;
  totalTargets: number;
}

export interface DeepMapSummary {
  locationId: string;
  locationName: string;
  entranceId: string;
  currentSceneId: string;
  nodes: DeepMapNodeSummary[];
  layers: DeepMapNodeSummary[][];
  pathToEntrance: string[];
  stepsToEntrance: number;
}

function sceneOrder(location: DeepLocation): Map<string, number> {
  return new Map(location.scenes.map((scene, index) => [scene.id, index]));
}

function sortedConnections(scene: DeepScene, order: ReadonlyMap<string, number>): string[] {
  return [...scene.connections].sort((left, right) => {
    const byDeclaration = (order.get(left) ?? Number.MAX_SAFE_INTEGER) - (order.get(right) ?? Number.MAX_SAFE_INTEGER);
    return byDeclaration || left.localeCompare(right);
  });
}

/**
 * Places every scene in its shortest-distance layer from the entrance. Within a
 * layer, declaration order is used so the result never depends on a game seed or
 * on incidental connection-array ordering.
 */
export function buildDeepMapLayout(location: DeepLocation): DeepMapLayout {
  const scenes = new Map(location.scenes.map((scene) => [scene.id, scene]));
  const order = sceneOrder(location);
  const depths = new Map<string, number>();
  const parents = new Map<string, string>();
  const queue: string[] = [];

  if (scenes.has(location.entrance)) {
    depths.set(location.entrance, 0);
    queue.push(location.entrance);
  }

  while (queue.length) {
    const sceneId = queue.shift()!;
    const scene = scenes.get(sceneId);
    if (!scene) continue;
    for (const connection of sortedConnections(scene, order)) {
      if (!scenes.has(connection) || depths.has(connection)) continue;
      depths.set(connection, (depths.get(sceneId) ?? 0) + 1);
      parents.set(connection, sceneId);
      queue.push(connection);
    }
  }

  const reachable = location.scenes
    .filter((scene) => depths.has(scene.id))
    .sort((left, right) => (depths.get(left.id) ?? 0) - (depths.get(right.id) ?? 0)
      || (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
  const maxDepth = Math.max(-1, ...depths.values());
  const layers = Array.from({ length: maxDepth + 1 }, (_, depth) => reachable
    .filter((scene) => depths.get(scene.id) === depth)
    .map((scene) => scene.id));
  const nodes = reachable.map((scene) => ({
    sceneId: scene.id,
    depth: depths.get(scene.id)!,
    order: layers[depths.get(scene.id)!].indexOf(scene.id),
    ...(parents.has(scene.id) ? { parentId: parents.get(scene.id) } : {}),
  }));

  return { locationId: location.id, entranceId: location.entrance, nodes, layers };
}

/** Returns an actual shortest route, including both the starting and entrance nodes. */
export function shortestPathToDeepEntrance(location: DeepLocation, fromSceneId: string): string[] {
  const scenes = new Map(location.scenes.map((scene) => [scene.id, scene]));
  if (!scenes.has(fromSceneId) || !scenes.has(location.entrance)) return [];
  if (fromSceneId === location.entrance) return [location.entrance];

  const order = sceneOrder(location);
  const previous = new Map<string, string>();
  const visited = new Set([fromSceneId]);
  const queue = [fromSceneId];

  while (queue.length) {
    const sceneId = queue.shift()!;
    const scene = scenes.get(sceneId)!;
    for (const connection of sortedConnections(scene, order)) {
      if (!scenes.has(connection) || visited.has(connection)) continue;
      visited.add(connection);
      previous.set(connection, sceneId);
      if (connection === location.entrance) {
        const reversed = [location.entrance];
        let cursor = location.entrance;
        while (cursor !== fromSceneId) {
          cursor = previous.get(cursor)!;
          reversed.push(cursor);
        }
        return reversed.reverse();
      }
      queue.push(connection);
    }
  }

  return [];
}

function nodeStatus(state: GameState, sceneId: string, adjacentScenes: ReadonlySet<string>): DeepMapNodeStatus {
  if (state.expedition?.sceneId === sceneId) return 'current';
  if (adjacentScenes.has(sceneId)) return 'adjacent';
  if (state.expedition?.discoveredScenes.includes(sceneId)) return 'discovered';
  return 'unknown';
}

/** Builds the seed-independent navigation model consumed by the exploration UI. */
export function summarizeDeepMap(state: GameState): DeepMapSummary | null {
  if (!state.expedition) return null;
  const location = DEEP_LOCATIONS[state.expedition.locationId];
  const currentScene = location?.scenes.find((scene) => scene.id === state.expedition?.sceneId);
  if (!location || !currentScene) return null;

  const layout = buildDeepMapLayout(location);
  const scenes = new Map(location.scenes.map((scene) => [scene.id, scene]));
  const adjacentScenes = new Set(currentScene.connections);
  const summaries = new Map(layout.nodes.map((node) => {
    const scene = scenes.get(node.sceneId)!;
    return [node.sceneId, {
      ...node,
      name: scene.name,
      status: nodeStatus(state, scene.id, adjacentScenes),
      isEntrance: scene.id === location.entrance,
      connections: [...scene.connections],
      processedTargets: scene.targets.filter((target) => isDeepTargetResolved(state, location.id, target)).length,
      totalTargets: scene.targets.length,
    } satisfies DeepMapNodeSummary];
  }));
  const pathToEntrance = shortestPathToDeepEntrance(location, currentScene.id);

  return {
    locationId: location.id,
    locationName: location.name,
    entranceId: location.entrance,
    currentSceneId: currentScene.id,
    nodes: layout.nodes.map((node) => summaries.get(node.sceneId)!),
    layers: layout.layers.map((layer) => layer.map((sceneId) => summaries.get(sceneId)!)),
    pathToEntrance,
    stepsToEntrance: Math.max(0, pathToEntrance.length - 1),
  };
}
