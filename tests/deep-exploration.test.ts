import test from 'node:test';
import assert from 'node:assert/strict';
import { DEEP_LOCATIONS, deepTargetFlag } from '../game/data/deep-exploration.ts';
import { ITEM_MAP } from '../game/data/items.ts';
import { adjustedDeepLoot, beginDeepExplore, deepOptionDisabledReason, leaveDeepExplore, moveDeepExplore, resolveDeepTarget } from '../game/engine/deep-exploration.ts';
import { addItem, inventoryCount } from '../game/engine/inventory.ts';
import { loadGame, saveGame } from '../game/engine/save.ts';
import { absoluteDay, createInitialState } from '../game/engine/state.ts';
import type { GameState, StorageLike } from '../game/types.ts';

function survival(seed = 'deep-market'): GameState {
  const state = createInitialState(seed);
  state.phase = 'survival';
  state.survivalDay = 2;
  state.clockMinutes = 7 * 60;
  state.currentEventId = undefined;
  state.weather = '晴冷';
  state.dailyPlan = { dayKey: 'survival:2', wishId: 'survival-care', deadlineId: 'open', actions: [] };
  state.inventory = addItem(state.inventory, ITEM_MAP.gloves, 1, absoluteDay(state));
  return state;
}

test('深入超市按区域移动、逐项计时，并始终预留返程时间', () => {
  const start = beginDeepExplore(survival(), 'riverside-market');
  assert.equal(start.ok, true);
  assert.equal(start.state.clockMinutes, 8 * 60);
  assert.equal(start.state.expedition?.sceneId, 'entrance');
  const moved = moveDeepExplore(start.state, 'checkout');
  assert.equal(moved.ok, true);
  assert.equal(moved.state.clockMinutes, 8 * 60 + 10);
  assert.equal(moved.state.expedition?.sceneId, 'checkout');
  assert.match(moved.state.logs.at(-1)?.title ?? '', /抵达/);
});

test('缺少工具、技能或情报时给出具体原因，不会消耗状态', () => {
  let state = beginDeepExplore(survival(), 'riverside-market').state;
  state = moveDeepExplore(state, 'checkout').state;
  const before = structuredClone(state);
  assert.match(deepOptionDisabledReason(state, 'cashier-cage', 'pick') ?? '', /薄片开锁组/);
  const failed = resolveDeepTarget(state, 'cashier-cage', 'pick');
  assert.equal(failed.ok, false);
  assert.deepEqual(failed.state, before);
});

test('不同解法产生不同收获，目标只能领取一次且技能经验可成长', () => {
  let quiet = survival('quiet-route');
  quiet.inventory = addItem(quiet.inventory, ITEM_MAP['lockpick-set'], 1, absoluteDay(quiet));
  quiet.explorationSkills.lockpicking = { level: 1, xp: 3 };
  quiet.intel = 2;
  quiet = beginDeepExplore(quiet, 'riverside-market').state;
  quiet = moveDeepExplore(quiet, 'checkout').state;
  const picked = resolveDeepTarget(quiet, 'cashier-cage', 'pick');
  assert.equal(picked.ok, true);
  assert.equal(inventoryCount(picked.state.inventory, 'batteries'), 2);
  assert.equal(inventoryCount(picked.state.inventory, 'chocolate'), 2);
  assert.equal(picked.state.explorationSkills.lockpicking.xp, 5);
  assert.ok(picked.state.flags.includes(deepTargetFlag('riverside-market', 'cashier-cage')));
  assert.equal(resolveDeepTarget(picked.state, 'cashier-cage', 'pick').ok, false);

  let forced = survival('forced-route');
  forced.inventory = addItem(forced.inventory, ITEM_MAP.crowbar, 1, absoluteDay(forced));
  forced = beginDeepExplore(forced, 'riverside-market').state;
  forced = moveDeepExplore(forced, 'checkout').state;
  const pried = resolveDeepTarget(forced, 'cashier-cage', 'crowbar');
  assert.equal(pried.ok, true);
  assert.equal(inventoryCount(pried.state.inventory, 'batteries'), 1);
  assert.equal(inventoryCount(pried.state.inventory, 'chocolate'), 1);
  assert.equal(pried.state.explorationSkills.toolUse.xp, 2);
});

test('返程结算探索愿望、保留未处理目标并记录带回物资', () => {
  let state = survival('leave-market');
  state.dailyPlan = { dayKey: 'survival:2', wishId: 'survival-explore', deadlineId: 'open', actions: [] };
  state = beginDeepExplore(state, 'riverside-market').state;
  state = moveDeepExplore(state, 'checkout').state;
  const left = leaveDeepExplore(state);
  assert.equal(left.ok, true);
  assert.equal(left.state.expedition, undefined);
  assert.equal(left.state.visited['riverside-market'], 1);
  assert.ok(left.state.dailyPlan?.actions.includes('survival:explore'));
  assert.doesNotMatch(left.state.flags.join(','), /cashier-cage/);
});

test('探索途中与技能进度可以通过本地存档完整恢复', () => {
  class MemoryStorage implements StorageLike {
    data = new Map<string, string>();
    getItem(key: string) { return this.data.get(key) ?? null; }
    setItem(key: string, value: string) { this.data.set(key, value); }
    removeItem(key: string) { this.data.delete(key); }
  }
  let state = beginDeepExplore(survival('deep-save'), 'qinghe-clinic').state;
  state = moveDeepExplore(state, 'pharmacy').state;
  state.explorationSkills.search = { level: 2, xp: 7 };
  const storage = new MemoryStorage();
  saveGame(storage, state);
  const restored = loadGame(storage);
  assert.equal(restored?.expedition?.locationId, 'qinghe-clinic');
  assert.equal(restored?.expedition?.sceneId, 'pharmacy');
  assert.deepEqual(restored?.explorationSkills.search, { level: 2, xp: 7 });
});

test('六处深入地点都可进入、移动并安全撤离', () => {
  assert.equal(Object.keys(DEEP_LOCATIONS).length, 6);
  for (const location of Object.values(DEEP_LOCATIONS)) {
    const started = beginDeepExplore(survival(`enter-${location.id}`), location.id);
    assert.equal(started.ok, true, `${location.name} 无法进入`);
    assert.equal(started.state.expedition?.sceneId, location.entrance);
    const entrance = location.scenes.find((scene) => scene.id === location.entrance)!;
    const moved = moveDeepExplore(started.state, entrance.connections[0]);
    assert.equal(moved.ok, true, `${location.name} 无法移动到相邻区域`);
    const returned = moveDeepExplore(moved.state, location.entrance);
    assert.equal(returned.ok, true, `${location.name} 的连接不是双向的`);
    assert.equal(leaveDeepExplore(returned.state).ok, true, `${location.name} 无法撤离`);
  }
});

test('变电站控制层支持钥匙与调查路线，且目标效果真实结算', () => {
  let keyed = survival('substation-key-deep');
  keyed.inventory = addItem(keyed.inventory, ITEM_MAP['station-key'], 1, absoluteDay(keyed));
  keyed = beginDeepExplore(keyed, 'north-substation').state;
  keyed = moveDeepExplore(keyed, 'lobby').state;
  keyed = moveDeepExplore(keyed, 'control-floor').state;
  assert.equal(deepOptionDisabledReason(keyed, 'control-core', 'key'), null);
  assert.match(deepOptionDisabledReason(keyed, 'control-core', 'route') ?? '', /备用入口路线/);
  const powerBefore = keyed.shelter.power;
  const resolved = resolveDeepTarget(keyed, 'control-core', 'key');
  assert.equal(resolved.ok, true);
  assert.equal(resolved.state.shelter.power, powerBefore + 10);
  assert.equal(inventoryCount(resolved.state.inventory, 'sample-tube'), 1);
  assert.equal(inventoryCount(resolved.state.inventory, 'station-key'), 1);
  assert.ok(resolved.state.flags.includes('substation-control-searched'));

  let routed = survival('substation-route-deep');
  routed.flags.push('substation-route');
  routed = beginDeepExplore(routed, 'north-substation').state;
  routed = moveDeepExplore(routed, 'lobby').state;
  routed = moveDeepExplore(routed, 'control-floor').state;
  assert.equal(deepOptionDisabledReason(routed, 'control-core', 'route'), null);
});

test('深入地点配置的连接、物品、效果和方法引用全部有效', () => {
  for (const location of Object.values(DEEP_LOCATIONS)) {
    assert.ok(location.approachRisk >= 0);
    assert.ok(location.scenes.length >= 5, `${location.name} 内部区域不足`);
    const sceneIds = new Set(location.scenes.map((scene) => scene.id));
    assert.ok(sceneIds.has(location.entrance));
    const reachable = new Set([location.entrance]);
    const queue = [location.entrance];
    while (queue.length) {
      const nextSceneId = queue.shift();
      const scene = location.scenes.find((entry) => entry.id === nextSceneId);
      assert.ok(scene, `${location.name} 的连通图包含未知区域`);
      for (const connection of scene.connections) if (!reachable.has(connection)) {
        assert.ok(sceneIds.has(connection), `${scene.id} 连接到未知区域 ${connection}`);
        reachable.add(connection);
        queue.push(connection);
      }
    }
    assert.equal(reachable.size, location.scenes.length, `${location.name} 存在不可达区域`);
    for (const scene of location.scenes) {
      for (const connection of scene.connections) {
        assert.ok(sceneIds.has(connection), `${scene.id} 连接到未知区域 ${connection}`);
        const reverse = location.scenes.find((entry) => entry.id === connection)?.connections.includes(scene.id);
        assert.equal(reverse, true, `${location.name} 的 ${scene.id} → ${connection} 不能原路返回`);
      }
      for (const target of scene.targets) {
        assert.ok(target.options.length >= 2, `${location.name}/${target.name} 缺少不同解法`);
        for (const option of target.options) {
          assert.ok(option.minutes > 0);
          assert.ok(option.stamina >= 0);
          for (const requirement of option.requirements ?? []) if (requirement.item) assert.ok(ITEM_MAP[requirement.item], `未知需求物品 ${requirement.item}`);
          for (const itemId of Object.keys(option.consumes ?? {})) assert.ok(ITEM_MAP[itemId], `未知消耗物品 ${itemId}`);
          for (const itemId of Object.keys(option.loot ?? {})) assert.ok(ITEM_MAP[itemId], `未知战利品 ${itemId}`);
          for (const itemId of Object.keys(option.effects?.inventory ?? {})) assert.ok(ITEM_MAP[itemId], `未知效果物品 ${itemId}`);
        }
      }
    }
  }
});

test('困难细化地图按种子削减普通战利品但完整保留剧情物品', () => {
  const normal = createInitialState('deep-loot-budget', [], 0, 'normal');
  const hard = createInitialState('deep-loot-budget', [], 0, 'hard');
  let normalRegular = 0;
  let hardRegular = 0;
  let normalStory = 0;
  let hardStory = 0;
  for (const location of Object.values(DEEP_LOCATIONS)) {
    for (const scene of location.scenes) {
      for (const target of scene.targets) {
        for (const option of target.options) {
          const key = `${location.id}:${target.id}:${option.id}`;
          const normalLoot = adjustedDeepLoot(normal, option.loot, key);
          const hardLoot = adjustedDeepLoot(hard, option.loot, key);
          for (const [itemId, quantity] of Object.entries(normalLoot)) {
            if (ITEM_MAP[itemId].story) normalStory += quantity;
            else normalRegular += quantity;
          }
          for (const [itemId, quantity] of Object.entries(hardLoot)) {
            if (ITEM_MAP[itemId].story) hardStory += quantity;
            else hardRegular += quantity;
          }
        }
      }
    }
  }
  assert.equal(hardStory, normalStory);
  assert.ok(hardRegular <= normalRegular * 0.7, `困难掉落 ${hardRegular}/${normalRegular} 未压到 70% 以下`);
  assert.ok(hardRegular >= normalRegular * 0.5, '困难地图仍应保留可规划的求生路线');
});
