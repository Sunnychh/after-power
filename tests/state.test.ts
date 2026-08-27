import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS } from '../game/data/items.ts';
import { EVENTS } from '../game/data/events.ts';
import { LOCATIONS, NPCS } from '../game/data/world.ts';
import { endDay, exploreLocation, exploreSubstationControl, performPrepAction, performSurvivalAction, substationControlAccess } from '../game/engine/actions.ts';
import { claimDailyReward, continueAfterMissedWish } from '../game/engine/daily.ts';
import { addItem, inventoryCount } from '../game/engine/inventory.ts';
import { applyEffect, createInitialState, dangerFactorText, dangerRisk, describeDanger, rollDanger, selectEvent } from '../game/engine/state.ts';
import { chooseEvacuation } from '../game/engine/outcomes.ts';
import { ITEM_MAP } from '../game/data/items.ts';
import { SURVIVAL_DAY_START, dayEndMinutes } from '../game/engine/time.ts';
import { isNpcUnlocked } from '../game/engine/npcs.ts';
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

test('危险概率由可追踪因素计算，日志明确说明比较规则', () => {
  const state = createInitialState('risk-explained', [], 0, 'normal', false, 'bridge');
  state.currentEventId = undefined;
  state.stats.health = 35;
  state.stats.stamina = 25;
  state.intel = 2;
  const calculation = dangerRisk(state, 40);
  assert.equal(calculation.risk, 56); // 40 + 健康10 + 体力8 + 债务4 - 情报6
  assert.match(dangerFactorText(calculation), /地点\/行动基础 40/);
  assert.match(dangerFactorText(calculation), /未结债务 4/);
  const result = rollDanger(state, 40);
  const explanation = describeDanger(result);
  assert.match(explanation, /随机值 \d+/);
  assert.match(explanation, /风险线 56|严重线 28/);
  assert.match(explanation, /风险构成/);
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
  state.autoRations = true;
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

test('变电站控制层需要钥匙或路线，钥匙提供低风险且不会消耗', () => {
  const locked = survivalState('control-locked');
  assert.equal(substationControlAccess(locked).available, false);
  assert.equal(exploreSubstationControl(locked).ok, false);

  const keyed = survivalState('control-keyed');
  keyed.inventory = addItem(keyed.inventory, ITEM_MAP['station-key'], 1, 8);
  assert.deepEqual(substationControlAccess(keyed), { available: true, method: 'key', baseRisk: 24 });
  const result = exploreSubstationControl(keyed);
  assert.equal(result.ok, true);
  assert.equal(inventoryCount(result.state.inventory, 'station-key'), 1);
  assert.equal(inventoryCount(result.state.inventory, 'sample-tube'), 1);
  assert.ok(result.state.flags.includes('substation-control-searched'));
  assert.equal(substationControlAccess(result.state).available, false);
});

test('变电站备用路线可替代钥匙，但基础危险更高', () => {
  const routed = survivalState('control-route');
  routed.flags.push('substation-route');
  assert.deepEqual(substationControlAccess(routed), { available: true, method: 'route', baseRisk: 52 });
  assert.equal(exploreSubstationControl(routed).ok, true);
});

test('有效广播按固定顺序逐个解锁人物，旧广播次数可直接恢复进度', () => {
  let state = survivalState('npc-radio');
  state.inventory = addItem(state.inventory, ITEM_MAP.radio, 1, 8);
  assert.equal(NPCS.filter((npc) => isNpcUnlocked(state, npc.id)).length, 0);
  const expected = ['chen-meng', 'lin-zhou', 'qiu-lan', 'pan-yue'];
  for (let index = 0; index < expected.length; index += 1) {
    state.shelter.power = 20;
    const result = performSurvivalAction(state, 'radio');
    assert.equal(result.ok, true);
    state = result.state;
    assert.equal(isNpcUnlocked(state, expected[index]), true);
    assert.equal(NPCS.filter((npc) => isNpcUnlocked(state, npc.id)).length, index + 1);
  }
});

test('未联络人物不会触发具名事件，交易也保持锁定', () => {
  const state = survivalState('npc-locked');
  state.inventory = addItem(state.inventory, ITEM_MAP.chocolate, 1, 8);
  assert.equal(performSurvivalAction(state, 'trade-water').ok, false);
  for (let index = 0; index < 20; index += 1) {
    state.currentEventId = undefined;
    const event = selectEvent(state);
    assert.equal(event?.npc, undefined);
    if (event) state.seenEvents.push(event.id);
  }
});

test('真相路线选择事件按难度在关键日稳定出现', () => {
  for (const [difficulty, decisionDay] of [['easy', 8], ['normal', 12], ['hard', 12]] as const) {
    const state = createInitialState(`route-${difficulty}`, [], 0, difficulty);
    state.phase = 'survival';
    state.survivalDay = decisionDay;
    state.broadcasts = 3;
    state.currentEventId = undefined;
    state.seenEvents = [];
    assert.equal(selectEvent(state)?.id, 'final-broadcast-window');
  }
});

test('内容配置达到 35 物品、36 事件、6 地点、4 NPC、5 条事件链', () => {
  assert.ok(ITEMS.length >= 35);
  assert.ok(EVENTS.length >= 36);
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
