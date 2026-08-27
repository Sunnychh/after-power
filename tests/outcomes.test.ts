import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseEvacuation, determineOutcome, truthEndingReady } from '../game/engine/outcomes.ts';
import { createInitialState } from '../game/engine/state.ts';
import { endDay } from '../game/engine/actions.ts';
import { activateDay } from './helpers.ts';

function evacuationState() {
  const state = createInitialState('ending');
  state.phase = 'survival' as const;
  state.survivalDay = 14;
  state.currentEventId = undefined;
  state.flags.push('survived-goal-night', 'evacuation-choice-pending');
  return state;
}

test('死亡判定优先于发送成功和撤离选择', () => {
  const state = evacuationState();
  state.stats.health = 0;
  state.flags.push('truth-transmitted', 'ending:truth');
  assert.equal(determineOutcome(state)?.id, 'death');
});

test('证据齐全与发送成功不会自动覆盖普通结局', () => {
  const state = evacuationState();
  state.flags.push('truth-transmitted');
  assert.equal(determineOutcome(state), null);
  const ordinary = chooseEvacuation(state, 'survivor');
  assert.equal(ordinary.ok, true);
  assert.equal(ordinary.state.outcome?.id, 'survivor');
});

test('隐藏结局必须由玩家显式选择且需要发送成功', () => {
  const blocked = evacuationState();
  assert.equal(chooseEvacuation(blocked, 'truth').ok, false);
  blocked.flags.push('truth-transmitted', 'evidence-signal');
  const truth = chooseEvacuation(blocked, 'truth');
  assert.equal(truth.ok, true);
  assert.equal(truth.state.outcome?.id, 'truth');
  assert.equal(truth.state.outcome?.variantId, 'truth-medical');
});

test('隐藏行动检查剧情承诺、证据、盟友、广播与单次窗口', () => {
  const state = evacuationState();
  state.flags = ['evidence-signal', 'evidence-ledger', 'evidence-van', 'decoded-broadcast', 'truth-window-open'];
  state.relationships['lin-zhou'] = 20;
  state.relationships['qiu-lan'] = 22;
  assert.equal(truthEndingReady(state), true);
  state.flags.push('truth-attempted');
  assert.equal(truthEndingReady(state), false);
  state.flags = state.flags.filter((flag) => flag !== 'truth-attempted' && flag !== 'truth-window-open');
  assert.equal(truthEndingReady(state), false);
});

test('相同大类结局会根据关键经历产生不同文案变体', () => {
  const solo = evacuationState();
  const soloEnding = chooseEvacuation(solo, 'survivor').state.outcome;
  const group = evacuationState();
  group.relationships['lin-zhou'] = 20;
  group.relationships['qiu-lan'] = 20;
  const groupEnding = chooseEvacuation(group, 'survivor').state.outcome;
  assert.equal(soloEnding?.id, 'survivor');
  assert.equal(groupEnding?.id, 'survivor');
  assert.notEqual(soloEnding?.variantId, groupEnding?.variantId);
  assert.notEqual(soloEnding?.text, groupEnding?.text);
});

test('死亡会根据孤立、尸潮和天气形成不同终局', () => {
  const isolated = evacuationState();
  isolated.isolationNights = 3;
  assert.equal(determineOutcome(isolated)?.variantId, 'death-isolation');

  const horde = evacuationState();
  horde.survivalDay = 8;
  horde.shelter.integrity = 0;
  assert.equal(determineOutcome(horde)?.variantId, 'death-horde');

  const cold = evacuationState();
  cold.stats.health = 0;
  cold.weather = '寒潮';
  cold.shelter.fuel = 0;
  assert.equal(determineOutcome(cold)?.variantId, 'death-cold');
});

test('玩家可以主动放弃撤离并进入留守者结局', () => {
  const state = evacuationState();
  state.debt = { tier: 'bridge', borrowed: 280, balance: 120, dueSurvivalDay: 5, minimumPayment: 80, missedCollections: 0, totalRepaid: 240 };
  const result = chooseEvacuation(state, 'remain');
  assert.equal(result.ok, true);
  assert.equal(result.state.outcome?.variantId, 'survivor-caretaker');
  assert.ok(result.state.outcome?.keyChoices.includes('留守街区'));
  assert.match(result.state.outcome?.text ?? '', /留守街区也不会让合同自动消失/);
  assert.doesNotMatch(result.state.outcome?.text ?? '', /离开封锁区时/);
});

test('夜间致死后立即终止，不再追加催收、孤立或“活着离开”的冲突叙事', () => {
  let state = evacuationState();
  state.flags = state.flags.filter((flag) => flag !== 'evacuation-choice-pending' && flag !== 'survived-goal-night');
  state = activateDay(state, 'survival-care');
  state.stats.health = 4;
  state.stats.satiety = 100;
  state.stats.hydration = 100;
  state.stats.morale = 0;
  state.broadcasts = 0;
  state.injuries = ['感染迹象'];
  state.debt = { tier: 'bridge', borrowed: 280, balance: 360, dueSurvivalDay: 5, minimumPayment: 80, missedCollections: 1, totalRepaid: 0 };

  const result = endDay(state);
  assert.equal(result.ok, true);
  assert.equal(result.state.phase, 'ended');
  assert.equal(result.state.outcome?.variantId, 'death-infection');
  assert.ok(result.state.logs.some((log) => log.title.includes('夜间结算')));
  assert.equal(result.state.logs.some((log) => log.title.includes('催收')), false);
  assert.equal(result.state.logs.some((log) => log.title.includes('无人回应')), false);
  assert.doesNotMatch(result.state.outcome?.text ?? '', /活下来|离开封锁区/);
  assert.equal(result.state.flags.includes('survived-goal-night'), false);
  assert.equal(result.state.flags.includes('evacuation-choice-pending'), false);
  assert.equal(result.state.dailySettlement, undefined);
});

test('催收导致避难所失守后不会继续结算孤立伤害', () => {
  let state = evacuationState();
  state.survivalDay = 6;
  state.flags = state.flags.filter((flag) => flag !== 'evacuation-choice-pending' && flag !== 'survived-goal-night');
  state = activateDay(state, 'survival-care');
  state.shelter.integrity = 2;
  state.stats.health = 100;
  state.stats.satiety = 100;
  state.stats.hydration = 100;
  state.stats.morale = 0;
  state.broadcasts = 0;
  state.debt = { tier: 'bridge', borrowed: 280, balance: 388, dueSurvivalDay: 5, minimumPayment: 80, missedCollections: 1, totalRepaid: 0 };

  const result = endDay(state);
  assert.equal(result.state.phase, 'ended');
  assert.equal(result.state.outcome?.id, 'death');
  assert.ok(result.state.logs.some((log) => log.title === '逾期催收 · 第 2 次'));
  assert.equal(result.state.logs.some((log) => log.title.includes('无人回应')), false);
  assert.equal(result.state.isolationNights, 0);
});
