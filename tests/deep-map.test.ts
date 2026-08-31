import test from 'node:test';
import assert from 'node:assert/strict';
import { DEEP_LOCATIONS } from '../game/data/deep-exploration.ts';
import { deepTargetCompletionFlag } from '../game/engine/deep-exploration.ts';
import { buildDeepMapLayout, shortestPathToDeepEntrance, summarizeDeepMap } from '../game/engine/deep-map.ts';
import { createInitialState } from '../game/engine/state.ts';

test('六张深入地图都能从入口生成稳定、完整的 BFS 层级', () => {
  assert.equal(Object.keys(DEEP_LOCATIONS).length, 6);
  for (const location of Object.values(DEEP_LOCATIONS)) {
    const first = buildDeepMapLayout(location);
    const second = buildDeepMapLayout(structuredClone(location));
    const ids = first.layers.flat();

    assert.deepEqual(second, first, `${location.name} 的布局不稳定`);
    assert.equal(first.layers[0]?.[0], location.entrance, `${location.name} 没有以入口为第 0 层`);
    assert.equal(ids.length, location.scenes.length, `${location.name} 的布局遗漏区域`);
    assert.equal(new Set(ids).size, location.scenes.length, `${location.name} 的布局重复区域`);

    const depth = new Map(first.nodes.map((node) => [node.sceneId, node.depth]));
    for (const scene of location.scenes) {
      for (const connection of scene.connections) {
        assert.ok(Math.abs(depth.get(scene.id)! - depth.get(connection)!) <= 1, `${location.name} 的相邻节点跨越多个 BFS 层`);
      }
    }
  }
});

test('全部区域都能取得真实且最短的入口路线', () => {
  for (const location of Object.values(DEEP_LOCATIONS)) {
    const depth = new Map(buildDeepMapLayout(location).nodes.map((node) => [node.sceneId, node.depth]));
    const scenes = new Map(location.scenes.map((scene) => [scene.id, scene]));
    for (const scene of location.scenes) {
      const path = shortestPathToDeepEntrance(location, scene.id);
      assert.equal(path[0], scene.id);
      assert.equal(path.at(-1), location.entrance);
      assert.equal(path.length, depth.get(scene.id)! + 1, `${location.name}/${scene.name} 不是最短返程路线`);
      for (let index = 1; index < path.length; index += 1) {
        assert.ok(scenes.get(path[index - 1])?.connections.includes(path[index]), `${location.name} 的路线包含不可通行跳转`);
      }
    }
  }
});

test('无效节点没有伪造路线，入口到自身为零步', () => {
  const location = DEEP_LOCATIONS['riverside-market'];
  assert.deepEqual(shortestPathToDeepEntrance(location, 'missing-scene'), []);
  assert.deepEqual(shortestPathToDeepEntrance(location, location.entrance), [location.entrance]);
});

test('导航摘要区分当前位置、相邻、已发现和未知区域', () => {
  const state = createInitialState('deep-map-summary');
  state.phase = 'survival';
  state.survivalDay = 2;
  state.expedition = {
    locationId: 'riverside-market',
    sceneId: 'food',
    startedAtMinutes: 480,
    discoveredScenes: ['entrance', 'checkout', 'food'],
    gathered: [],
  };

  const summary = summarizeDeepMap(state)!;
  const status = Object.fromEntries(summary.nodes.map((node) => [node.sceneId, node.status]));
  assert.equal(status.food, 'current');
  assert.equal(status.entrance, 'adjacent');
  assert.equal(status['cold-storage'], 'adjacent');
  assert.equal(status.warehouse, 'adjacent');
  assert.equal(status.checkout, 'discovered');
  assert.equal(status.household, 'unknown');
  assert.deepEqual(summary.pathToEntrance, ['food', 'entrance']);
  assert.equal(summary.stepsToEntrance, 1);
});

test('每个节点按现有刷新规则统计已处理目标', () => {
  const state = createInitialState('deep-map-targets');
  state.phase = 'survival';
  state.survivalDay = 4;
  state.expedition = {
    locationId: 'riverside-market',
    sceneId: 'toilet',
    startedAtMinutes: 480,
    discoveredScenes: ['entrance', 'checkout', 'toilet'],
    gathered: [],
  };
  const location = DEEP_LOCATIONS['riverside-market'];
  const toilet = location.scenes.find((scene) => scene.id === 'toilet')!;
  state.flags.push(deepTargetCompletionFlag(location.id, toilet.targets[0], state.survivalDay));

  const summary = summarizeDeepMap(state)!;
  const node = summary.nodes.find((entry) => entry.sceneId === 'toilet')!;
  assert.equal(node.totalTargets, 2);
  assert.equal(node.processedTargets, 1);
});

test('不在深入探索中时不生成误导性地图摘要', () => {
  assert.equal(summarizeDeepMap(createInitialState('deep-map-idle')), null);
});
