import test from 'node:test';
import assert from 'node:assert/strict';
import { DEEP_LOCATIONS, type DeepTargetOption } from '../game/data/deep-exploration.ts';
import { ITEM_MAP, ITEMS } from '../game/data/items.ts';
import { CRITICAL_PROGRESSION_ITEMS } from '../game/data/progression.ts';
import { TRADE_OFFERS } from '../game/data/trades.ts';
import { beginDeepExplore, deepOptionDisabledReason, deepTargetRefreshMode, resolveDeepTarget } from '../game/engine/deep-exploration.ts';
import { inventoryCount } from '../game/engine/inventory.ts';
import { createInitialState } from '../game/engine/state.ts';

interface DeepSource {
  locationId: string;
  targetId: string;
  option: DeepTargetOption;
}

function deepSources(itemId: string): DeepSource[] {
  return Object.values(DEEP_LOCATIONS).flatMap((location) => location.scenes.flatMap((scene) => (
    scene.targets.flatMap((target) => target.options
      .filter((option) => (option.loot?.[itemId] ?? 0) > 0 || (option.effects?.inventory?.[itemId] ?? 0) > 0)
      .map((option) => ({ locationId: location.id, targetId: target.id, option })))
  )));
}

function itemDependencies(option: DeepTargetOption): string[] {
  return [
    ...(option.requirements ?? []).flatMap((requirement) => requirement.item ? [requirement.item] : []),
    ...Object.keys(option.consumes ?? {}),
  ];
}

test('每件剧情物品与关键进度物品都有灾后探索或随机交易来源', () => {
  const criticalIds = new Set(CRITICAL_PROGRESSION_ITEMS.map((entry) => entry.itemId));
  for (const item of ITEMS.filter((entry) => entry.story)) criticalIds.add(item.id as typeof CRITICAL_PROGRESSION_ITEMS[number]['itemId']);

  for (const itemId of criticalIds) {
    assert.ok(ITEM_MAP[itemId], `关键物品 ${itemId} 没有定义`);
    const explore = deepSources(itemId);
    const trade = TRADE_OFFERS.filter((offer) => (offer.receive[itemId] ?? 0) > 0);
    assert.ok(explore.length + trade.length > 0, `${ITEM_MAP[itemId].name} 只能灾前购买或没有任何获取途径`);
  }
});

test('关键物品来源没有自锁，且困难模式不会随机删掉唯一补救物品', () => {
  for (const definition of CRITICAL_PROGRESSION_ITEMS) {
    const sources = deepSources(definition.itemId);
    assert.ok(sources.some(({ option }) => !itemDependencies(option).includes(definition.itemId)), `${definition.itemId} 的所有探索来源都要求先持有自身`);
    assert.ok(sources.some(({ option }) => (
      ITEM_MAP[definition.itemId].story || option.guaranteedLoot?.includes(definition.itemId)
    )), `${definition.itemId} 没有不受困难物资削减影响的可靠来源`);
  }
});

test('从零灾前工具出发，关键物品依赖图仍可逐层获得，不存在物品循环锁', () => {
  const reachable = new Set<string>();
  const allOptions = Object.values(DEEP_LOCATIONS).flatMap((location) => location.scenes.flatMap((scene) => (
    scene.targets.flatMap((target) => target.options)
  )));

  let changed = true;
  while (changed) {
    changed = false;
    for (const option of allOptions) {
      if (!itemDependencies(option).every((itemId) => reachable.has(itemId))) continue;
      const gains = [
        ...Object.keys(option.loot ?? {}),
        ...Object.entries(option.effects?.inventory ?? {}).filter(([, quantity]) => (quantity ?? 0) > 0).map(([itemId]) => itemId),
      ];
      for (const itemId of gains) if (!reachable.has(itemId)) {
        reachable.add(itemId);
        changed = true;
      }
    }
    for (const offer of TRADE_OFFERS) {
      if (!reachable.has('radio') || !Object.keys(offer.give).every((itemId) => reachable.has(itemId))) continue;
      for (const itemId of Object.keys(offer.receive)) if (!reachable.has(itemId)) {
        reachable.add(itemId);
        changed = true;
      }
    }
  }

  for (const definition of CRITICAL_PROGRESSION_ITEMS) {
    assert.ok(reachable.has(definition.itemId), `${ITEM_MAP[definition.itemId].name} 被物品依赖链永久锁住：${definition.fallback}`);
  }
});

test('变电站控制层除铜钥匙外始终有不依赖物品的备用路线来源', () => {
  const routeOptions = Object.values(DEEP_LOCATIONS).flatMap((location) => location.scenes.flatMap((scene) => (
    scene.targets.flatMap((target) => target.options.filter((option) => option.addFlags?.includes('substation-route')))
  )));
  assert.ok(routeOptions.some((option) => itemDependencies(option).length === 0), '备用路线仍被工具或钥匙锁住');
});

test('关键保底货格每轮只能结算一次，不能绕过困难稀缺反复刷新', () => {
  for (const location of Object.values(DEEP_LOCATIONS)) {
    for (const scene of location.scenes) {
      for (const target of scene.targets) {
        if (!target.options.some((option) => option.guaranteedLoot?.length)) continue;
        assert.equal(deepTargetRefreshMode(target), 'once', `${location.name}/${target.name} 的关键保底物资仍会按日刷新`);
      }
    }
  }
});

test('背包只够关键物品时会先装入关键物，不会被普通战利品挤掉后永久结算目标', () => {
  let state = createInitialState('critical-loot-reservation');
  state.phase = 'survival';
  state.survivalDay = 2;
  state.clockMinutes = 7 * 60;
  state.currentEventId = undefined;
  state.weather = '晴冷';
  state.inventory = {};
  state.carryCapacity = 0.15;
  state.intel = 1;
  state.dailyPlan = { dayKey: 'survival:2', wishId: 'survival-explore', deadlineId: 'open', actions: [] };

  state = beginDeepExplore(state, 'qinghe-clinic').state;
  assert.equal(deepOptionDisabledReason(state, 'triage-drawer', 'search'), null);
  const result = resolveDeepTarget(state, 'triage-drawer', 'search');

  assert.equal(result.ok, true);
  assert.equal(inventoryCount(result.state.inventory, 'lab-badge'), 1);
  assert.ok(result.state.flags.some((flag) => flag.startsWith('deep:qinghe-clinic:triage-drawer')));
  assert.match(result.state.logs.at(-1)?.body ?? '', /疾控中心工牌 ×1/);
});
