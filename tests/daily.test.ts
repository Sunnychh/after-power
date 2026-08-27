import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_MAP } from '../game/data/items.ts';
import { endDay, performPrepAction } from '../game/engine/actions.ts';
import { chooseDailyDeadline, chooseDailyWish, claimDailyReward } from '../game/engine/daily.ts';
import { addItem, inventoryCount } from '../game/engine/inventory.ts';
import { createInitialState } from '../game/engine/state.ts';
import { PREP_DAY_START } from '../game/engine/time.ts';

function plannedPrep(wish: 'prep-income' | 'prep-home' | 'prep-contact', deadline: 'early' | 'steady' | 'open' = 'open') {
  const state = createInitialState(`daily-${wish}-${deadline}`);
  state.currentEventId = undefined;
  const selected = chooseDailyWish(state, wish);
  assert.equal(selected.ok, true);
  const timed = chooseDailyDeadline(selected.state, deadline);
  assert.equal(timed.ok, true);
  return timed.state;
}

test('未选择愿望与时限时不能偷偷执行行动', () => {
  const state = createInitialState('daily-block');
  state.currentEventId = undefined;
  assert.equal(performPrepAction(state, 'work').ok, false);
  const wish = chooseDailyWish(state, 'prep-income');
  assert.equal(performPrepAction(wish.state, 'work').ok, false);
});

test('愿望记录首次达成时刻，日终逐项发点并必须选择奖励', () => {
  const state = plannedPrep('prep-income', 'early');
  const worked = performPrepAction(state, 'work');
  assert.equal(worked.ok, true);
  assert.equal(worked.state.dailyPlan?.completedAtMinutes, PREP_DAY_START + 240);
  const settled = endDay(worked.state);
  assert.equal(settled.ok, true);
  assert.equal(settled.state.dailySettlement?.wishAchieved, true);
  assert.equal(settled.state.dailySettlement?.deadlineAchieved, true);
  assert.equal(settled.state.dailySettlement?.earnedPoints, 5);
  assert.equal(settled.state.dailyPoints, 5);
  assert.equal(performPrepAction(settled.state, 'rest').ok, false);

  settled.state.dailySettlement!.rewardChoices = ['quiet-rest', 'water-cache', 'food-cache'];
  const rewarded = claimDailyReward(settled.state, 'water-cache');
  assert.equal(rewarded.ok, true);
  assert.equal(rewarded.state.dailyPoints, 3);
  assert.equal(inventoryCount(rewarded.state.inventory, 'water-bottle'), 1);
  assert.equal(rewarded.state.shelter.water, settled.state.shelter.water + 2);
  assert.equal(rewarded.state.dailySettlement, undefined);
});

test('刚好抵达日终的最后一个行动仍计入愿望，待领奖时不能重复结算', () => {
  const state = plannedPrep('prep-income', 'open');
  state.clockMinutes = 18 * 60;
  const settled = performPrepAction(state, 'work');
  assert.equal(settled.ok, true);
  assert.equal(settled.state.prepDay, 2);
  assert.equal(settled.state.dailySettlement?.wishAchieved, true);
  assert.equal(settled.state.dailySettlement?.completedAtMinutes, 22 * 60);
  assert.equal(settled.state.dailyPoints, 3);

  const snapshot = structuredClone(settled.state);
  const duplicate = endDay(settled.state);
  assert.equal(duplicate.ok, false);
  assert.deepEqual(duplicate.state, snapshot);
});

test('恰好在时限分钟完成算成功，晚一分钟则不加时限分', () => {
  const exact = plannedPrep('prep-income', 'steady');
  exact.clockMinutes = 16 * 60;
  const exactWork = performPrepAction(exact, 'work');
  assert.equal(exactWork.state.dailyPlan?.completedAtMinutes, 20 * 60);
  assert.equal(endDay(exactWork.state).state.dailySettlement?.deadlineAchieved, true);

  const late = plannedPrep('prep-income', 'steady');
  late.clockMinutes = 16 * 60 + 1;
  const lateWork = performPrepAction(late, 'work');
  assert.equal(lateWork.state.dailyPlan?.completedAtMinutes, 20 * 60 + 1);
  const lateSettlement = endDay(lateWork.state).state.dailySettlement;
  assert.equal(lateSettlement?.deadlineAchieved, false);
  assert.equal(lateSettlement?.earnedPoints, 3);
});

test('奖励点不足时状态完全不变，且每日总有一项 1 点奖励', () => {
  const state = plannedPrep('prep-contact', 'open');
  const settled = endDay(state).state;
  assert.equal(settled.dailyPoints, 1);
  assert.ok(settled.dailySettlement?.rewardChoices.includes('quiet-rest'));
  const snapshot = structuredClone(settled);
  const blocked = claimDailyReward(settled, 'repair-kit');
  assert.equal(blocked.ok, false);
  assert.deepEqual(blocked.state, snapshot);
  assert.equal(claimDailyReward(settled, 'quiet-rest').ok, true);
});

test('灾前进入新一天也会移除已经腐烂的批次', () => {
  const state = plannedPrep('prep-contact', 'open');
  state.inventory = addItem(state.inventory, ITEM_MAP['fresh-apples'], 1, 1);
  state.inventory['fresh-apples'][0].expiresOn = 1;
  const settled = endDay(state).state;
  assert.equal(settled.prepDay, 2);
  assert.equal(inventoryCount(settled.inventory, 'fresh-apples'), 0);
  assert.ok(settled.logs.some((log) => log.body.includes('已经腐烂')));
});
