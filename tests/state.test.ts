import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS } from '../game/data/items.ts';
import { EVENTS } from '../game/data/events.ts';
import { LOCATIONS, NPCS } from '../game/data/world.ts';
import { endDay, exploreLocation, performPrepAction } from '../game/engine/actions.ts';
import { claimDailyReward, continueAfterMissedWish } from '../game/engine/daily.ts';
import { addItem, inventoryCount } from '../game/engine/inventory.ts';
import { applyEffect, createInitialState, selectEvent } from '../game/engine/state.ts';
import { chooseEvacuation } from '../game/engine/outcomes.ts';
import { ITEM_MAP } from '../game/data/items.ts';
import { SURVIVAL_DAY_START, dayEndMinutes } from '../game/engine/time.ts';
import { activateDay } from './helpers.ts';

function survivalState(seed: string) {
  const state = createInitialState(seed);
  state.phase = 'survival';
  state.prepDay = 7;
  state.survivalDay = 1;
  state.currentEventId = undefined;
  state.clockMinutes = SURVIVAL_DAY_START;
  state.weather = '晴冷' as const;
  return activateDay(state, 'survival-care');
}

test('核心状态变化截断在 0 到 100', () => {
  const state = createInitialState('clamp');
  const next = applyEffect(state, { stats: { health: 99, hydration: -999 }, shelter: { integrity: 99, power: -99 } }, '测试');
  assert.equal(next.stats.health, 100);
  assert.equal(next.stats.hydration, 0);
  assert.equal(next.shelter.integrity, 100);
  assert.equal(next.shelter.power, 0);
});

test('灾前剩余时间不足时不会推进时钟或扣钱', () => {
  const state = createInitialState('illegal');
  state.currentEventId = undefined;
  state.clockMinutes = dayEndMinutes(state) - 60;
  const snapshot = structuredClone(state);
  const result = performPrepAction(state, 'reinforce');
  assert.equal(result.ok, false);
  assert.deepEqual(result.state, snapshot);
});

test('夜间结算明确消耗食物与饮水', () => {
  const state = survivalState('ration');
  state.stats.satiety = 55;
  state.stats.hydration = 55;
  state.inventory = addItem(state.inventory, ITEM_MAP.crackers, 1, 8);
  state.inventory = addItem(state.inventory, ITEM_MAP['water-bottle'], 1, 8);
  const result = endDay(state);
  assert.equal(result.ok, true);
  assert.equal(inventoryCount(result.state.inventory, 'crackers'), 0);
  assert.equal(inventoryCount(result.state.inventory, 'water-bottle'), 0);
  assert.ok(result.state.logs.some((log) => log.title.includes('夜间结算')));
});

test('同种子、同操作得到一致探索结果', () => {
  const first = survivalState('AFTERLIGHT-001');
  const second = survivalState('AFTERLIGHT-001');
  const a = exploreLocation(first, 'riverside-market');
  const b = exploreLocation(second, 'riverside-market');
  assert.equal(a.ok, true);
  assert.deepEqual(a.state, b.state);
});

test('真相路线选择事件按难度在关键日稳定出现', () => {
  for (const [difficulty, decisionDay] of [['easy', 8], ['normal', 12], ['hard', 12]] as const) {
    const state = createInitialState(`route-${difficulty}`, [], 0, difficulty);
    state.phase = 'survival';
    state.survivalDay = decisionDay;
    state.currentEventId = undefined;
    state.seenEvents = [];
    assert.equal(selectEvent(state)?.id, 'final-broadcast-window');
  }
});

test('内容配置达到 35 物品、30 事件、6 地点、4 NPC、5 条事件链', () => {
  assert.ok(ITEMS.length >= 35);
  assert.ok(EVENTS.length >= 30);
  assert.ok(LOCATIONS.length >= 6);
  assert.ok(NPCS.length >= 4);
  const chains = new Set(EVENTS.flatMap((event) => event.chain ? [event.chain.id] : []));
  assert.ok(chains.size >= 5);
  for (const event of EVENTS) {
    assert.ok(event.options.length >= 2, `${event.id} 缺少有效分支`);
    assert.ok(event.options.some((option) => !option.requirements?.length), `${event.id} 可能形成物品软锁`);
  }
});

test('无规划安全机器人也会在有限天数内抵达结局', () => {
  for (let index = 0; index < 100; index += 1) {
    let state = survivalState(`bot-${index}`);
    let guard = 0;
    while (state.phase !== 'ended' && guard < 50) {
      if (state.dailySettlement) {
        state = state.dailySettlement.wishAchieved
          ? claimDailyReward(state, 'quiet-rest').state
          : continueAfterMissedWish(state).state;
      } else if (state.flags.includes('evacuation-choice-pending')) {
        state = chooseEvacuation(state, 'survivor').state;
      } else {
        state = activateDay(state, 'survival-care');
        state.currentEventId = undefined;
        state = endDay(state).state;
      }
      guard += 1;
    }
    assert.equal(state.phase, 'ended', `seed bot-${index} 未终止`);
    assert.ok(state.outcome);
  }
});
