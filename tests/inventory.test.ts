import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_MAP, ITEMS } from '../game/data/items.ts';
import { addItem, batchExpiryStatus, expireItems, inventoryCount, inventoryWeight, removeItem } from '../game/engine/inventory.ts';

test('背包增减、堆叠与重量保持守恒', () => {
  let inventory = {};
  inventory = addItem(inventory, ITEM_MAP['water-bottle'], 2, 1);
  inventory = addItem(inventory, ITEM_MAP.crackers, 3, 1);
  assert.equal(inventoryCount(inventory, 'water-bottle'), 2);
  assert.equal(inventoryCount(inventory, 'crackers'), 3);
  assert.equal(inventoryWeight(inventory, ITEM_MAP), 2 * 1.05 + 3 * 0.35);

  const removed = removeItem(inventory, 'crackers', 2);
  assert.ok(removed);
  assert.equal(inventoryCount(removed, 'crackers'), 1);
  assert.equal(inventoryCount(inventory, 'crackers'), 3, '原背包不可被原地修改');
});

test('不足数量的移除失败且原背包不变', () => {
  const inventory = addItem({}, ITEM_MAP.bandage, 1, 1);
  const snapshot = structuredClone(inventory);
  assert.equal(removeItem(inventory, 'bandage', 2), null);
  assert.deepEqual(inventory, snapshot);
});

test('易腐物品按批次过期，不影响其他物资', () => {
  let inventory = addItem({}, ITEM_MAP['fresh-apples'], 2, 1);
  inventory = addItem(inventory, ITEM_MAP['water-bottle'], 1, 1);
  const result = expireItems(inventory, 7);
  assert.equal(result.expired['fresh-apples'], 2);
  assert.equal(inventoryCount(result.inventory, 'fresh-apples'), 0);
  assert.equal(inventoryCount(result.inventory, 'water-bottle'), 1);
});

test('每个易腐批次都有准确剩余天数与到期边界', () => {
  assert.deepEqual(batchExpiryStatus(10, 8), { state: 'fresh', remainingDays: 2, label: '剩余 2 天' });
  assert.deepEqual(batchExpiryStatus(8, 8), { state: 'due', remainingDays: 0, label: '今天到期（今日可用）' });
  assert.equal(batchExpiryStatus(7, 8).state, 'spoiled');
  assert.equal(batchExpiryStatus(undefined, 8).label, '长期保存');
});

test('同日易腐物合并、不同日分批，新增物品不修改旧库存', () => {
  const first = addItem({}, ITEM_MAP['fresh-apples'], 1, 1);
  const sameDay = addItem(first, ITEM_MAP['fresh-apples'], 2, 1);
  const later = addItem(sameDay, ITEM_MAP['fresh-apples'], 1, 2);
  assert.equal(first['fresh-apples'][0].quantity, 1);
  assert.equal(sameDay['fresh-apples'].length, 1);
  assert.equal(sameDay['fresh-apples'][0].quantity, 3);
  assert.equal(later['fresh-apples'].length, 2);
  assert.deepEqual(later['fresh-apples'].map((batch) => batch.expiresOn), [6, 7]);
});

test('首版物品数量与类别达到内容下限', () => {
  assert.ok(ITEMS.length >= 35);
  for (const category of ['食物', '饮水', '药品', '工具', '能源', '防护', '材料', '特殊']) {
    assert.ok(ITEMS.some((item) => item.category === category), `缺少类别 ${category}`);
  }
});
