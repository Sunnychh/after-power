import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_MAP } from '../game/data/items.ts';
import { EVENT_MAP } from '../game/data/events.ts';
import { resolveCurrentEvent } from '../game/engine/actions.ts';
import { addItem, inventoryCount, removeItem } from '../game/engine/inventory.ts';
import { createInitialState, selectEvent } from '../game/engine/state.ts';
import type { GameState } from '../game/types.ts';
import { activateDay } from './helpers.ts';

function lateHard(): GameState {
  const state = activateDay(createInitialState('hard-stock-pressure', [], 0, 'hard'), 'survival-care');
  state.phase = 'survival';
  state.survivalDay = 9;
  state.currentEventId = undefined;
  state.broadcasts = 4;
  state.inventory = removeItem(state.inventory, 'water-bottle', inventoryCount(state.inventory, 'water-bottle')) ?? {};
  return state;
}

test('困难后期库存事件只在玩家确实持有对应物资时进入候选', () => {
  const empty = lateHard();
  const emptyCandidates = Object.values(EVENT_MAP).filter((event) => event.hardStockPressure && event.inventoryAny?.some((itemId) => inventoryCount(empty.inventory, itemId) > 0));
  assert.equal(emptyCandidates.length, 0);

  const stocked = lateHard();
  stocked.inventory = addItem(stocked.inventory, ITEM_MAP['water-bottle'], 2, 16);
  const selected = selectEvent(stocked);
  assert.equal(selected?.id, 'hard-water-corridor');
  assert.ok(selected?.inventoryAny?.includes('water-bottle'));
});

test('标准难度不会抽取困难库存压力事件', () => {
  const state = lateHard();
  state.difficulty = 'normal';
  state.inventory = addItem(state.inventory, ITEM_MAP['water-bottle'], 2, 16);
  assert.notEqual(selectEvent(state)?.hardStockPressure, true);
});

test('库存压力事件始终保留无物品软锁选项，投入物资则严格扣除并产生差异后果', () => {
  for (const event of Object.values(EVENT_MAP).filter((entry) => entry.hardStockPressure)) {
    assert.ok(event.options.some((option) => !option.requirements?.length), `${event.id} 缺少拒绝或保留物资的兜底选项`);
    for (const itemId of event.inventoryAny ?? []) {
      assert.ok(event.options.some((option) => option.requirements?.some((requirement) => requirement.item === itemId && (requirement.quantity ?? 1) === 1)), `${event.id} 会被 ${itemId} 触发，但没有当前持有 1 件时可执行的消耗选项`);
    }
  }
  const state = lateHard();
  state.inventory = addItem(state.inventory, ITEM_MAP['water-bottle'], 2, 16);
  state.currentEventId = 'hard-water-corridor';
  const before = inventoryCount(state.inventory, 'water-bottle');
  const resolved = resolveCurrentEvent(state, 0);
  assert.equal(resolved.ok, true);
  assert.equal(inventoryCount(resolved.state.inventory, 'water-bottle'), before - 2);
  assert.equal(resolved.state.relationships['chen-meng'], 10);
});
