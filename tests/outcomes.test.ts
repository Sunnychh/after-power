import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseEvacuation, determineOutcome, truthEndingReady } from '../game/engine/outcomes.ts';
import { createInitialState } from '../game/engine/state.ts';

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
