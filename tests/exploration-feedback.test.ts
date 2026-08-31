import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_MAP } from '../game/data/items.ts';
import { beginDeepExplore, leaveDeepExplore, moveDeepExplore, resolveDeepTarget } from '../game/engine/deep-exploration.ts';
import { completeTimedAction } from '../game/engine/day.ts';
import { addItem } from '../game/engine/inventory.ts';
import { absoluteDay, createInitialState } from '../game/engine/state.ts';
import { SURVIVAL_DAY_START } from '../game/engine/time.ts';

function survival(seed: string) {
  const state = createInitialState(seed, [], 0, 'easy');
  state.phase = 'survival' as const;
  state.survivalDay = 2;
  state.clockMinutes = SURVIVAL_DAY_START;
  state.currentEventId = undefined;
  state.weather = '晴冷';
  state.dailyPlan = { dayKey: 'survival:2', wishId: 'survival-care', deadlineId: 'open', actions: [] };
  state.inventory = addItem(state.inventory, ITEM_MAP['lockpick-set'], 1, absoluteDay(state));
  state.explorationSkills.lockpicking = { level: 1, xp: 3 };
  state.intel = 2;
  return state;
}

test('白天每两小时仍结算饱腹与水分，但不向生存日志灌入配给条目', () => {
  const state = survival('quiet-ration-log');
  const satietyBefore = state.stats.satiety;
  const hydrationBefore = state.stats.hydration;
  const result = completeTimedAction(state, 120, 'test:wait');
  assert.equal(result.ok, true);
  assert.ok(result.state.stats.satiety < satietyBefore);
  assert.ok(result.state.stats.hydration < hydrationBefore);
  assert.ok(result.state.feedback.some((item) => item.reason.includes('行动消耗')));
  assert.equal(result.state.logs.some((log) => log.title === '白天配给消耗'), false);
});

test('深入搜索保留本次所得，返程后仍以反馈条明确告知带回物资', () => {
  let state = beginDeepExplore(survival('visible-expedition-loot'), 'riverside-market').state;
  state = moveDeepExplore(state, 'checkout').state;
  const searched = resolveDeepTarget(state, 'cashier-cage', 'pick');
  assert.equal(searched.ok, true);
  const gathered = searched.state.expedition?.gathered ?? [];
  assert.ok(gathered.length >= 2);
  assert.ok(gathered.some((entry) => entry === '电池组 ×2'));
  assert.ok(searched.state.feedback.some((item) => item.reason === '现场所得'));

  const returned = leaveDeepExplore(searched.state);
  assert.equal(returned.ok, true);
  assert.equal(returned.state.expedition, undefined);
  for (const entry of gathered) {
    const match = entry.match(/^(.*) ×(\d+)$/);
    assert.ok(match);
    assert.ok(returned.state.feedback.some((item) => item.label === match[1] && item.delta === Number(match[2]) && item.reason === '本次外出带回'));
  }
});
