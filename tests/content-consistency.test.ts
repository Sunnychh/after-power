import test from 'node:test';
import assert from 'node:assert/strict';
import { DIFFICULTIES } from '../game/data/difficulties.ts';
import { EVENTS } from '../game/data/events.ts';
import { ITEMS } from '../game/data/items.ts';
import { RECIPES } from '../game/data/recipes.ts';
import { LOCATIONS, NPCS } from '../game/data/world.ts';

function assertUniqueIds(label: string, entries: Array<{ id: string }>) {
  const ids = entries.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length, `${label}存在重复 ID`);
  assert.ok(ids.every(Boolean), `${label}存在空 ID`);
}

test('物品、事件、地点、人物与配方 ID 均唯一', () => {
  assertUniqueIds('物品', ITEMS);
  assertUniqueIds('事件', EVENTS);
  assertUniqueIds('地点', LOCATIONS);
  assertUniqueIds('人物', NPCS);
  assertUniqueIds('配方', RECIPES);
});

test('全部内容引用都指向实际存在的物品和人物', () => {
  const itemIds = new Set(ITEMS.map((item) => item.id));
  const npcIds = new Set(NPCS.map((npc) => npc.id));
  const requireItem = (source: string, itemId: string) => assert.ok(itemIds.has(itemId), `${source}引用了不存在的物品 ${itemId}`);

  for (const difficulty of DIFFICULTIES) {
    for (const itemId of Object.keys(difficulty.startingInventory)) requireItem(`难度 ${difficulty.id}`, itemId);
  }
  for (const location of LOCATIONS) {
    for (const itemId of location.loot) requireItem(`地点 ${location.id}`, itemId);
    if (location.uniqueItem) requireItem(`地点 ${location.id}`, location.uniqueItem);
  }
  for (const recipe of RECIPES) {
    for (const itemId of Object.keys(recipe.ingredients)) requireItem(`配方 ${recipe.id}`, itemId);
    requireItem(`配方 ${recipe.id}`, recipe.output);
    assert.ok(recipe.energy > 0 && recipe.water >= 0, `配方 ${recipe.id} 的能源或用水配置无效`);
  }
  for (const event of EVENTS) {
    if (event.npc) assert.ok(npcIds.has(event.npc), `事件 ${event.id} 引用了不存在的人物 ${event.npc}`);
    if (event.minDay !== undefined && event.maxDay !== undefined) assert.ok(event.minDay <= event.maxDay, `事件 ${event.id} 日期范围倒置`);
    for (const [index, option] of event.options.entries()) {
      for (const requirement of option.requirements ?? []) if (requirement.item) requireItem(`事件 ${event.id} 选项 ${index + 1}`, requirement.item);
      for (const [itemId, delta] of Object.entries(option.effects?.inventory ?? {})) {
        requireItem(`事件 ${event.id} 选项 ${index + 1}`, itemId);
        if (delta < 0) {
          assert.ok(
            option.requirements?.some((requirement) => requirement.item === itemId && (requirement.quantity ?? 1) >= -delta),
            `事件 ${event.id} 选项 ${index + 1} 消耗 ${itemId} 却没有等量前置条件`,
          );
        }
      }
      for (const npcId of Object.keys(option.effects?.relationships ?? {})) {
        assert.ok(npcIds.has(npcId), `事件 ${event.id} 选项 ${index + 1} 引用了不存在的人物 ${npcId}`);
      }
      if (option.danger !== undefined) assert.ok(option.danger > 0 && option.danger <= 100, `事件 ${event.id} 的危险值越界`);
    }
  }
});

test('物品数值均为有限值，易腐与商店配置不会产生负数', () => {
  for (const item of ITEMS) {
    assert.ok(Number.isFinite(item.price) && item.price >= 0, `${item.id} 价格无效`);
    assert.ok(Number.isFinite(item.weight) && item.weight >= 0, `${item.id} 重量无效`);
    if (item.perishableDays !== undefined) assert.ok(item.perishableDays > 0, `${item.id} 保质期无效`);
    for (const [key, value] of Object.entries(item.effects ?? {})) assert.ok(Number.isFinite(value), `${item.id} 的 ${key} 效果无效`);
  }
});
