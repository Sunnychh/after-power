import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_MAP } from '../game/data/items.ts';
import { endDay, performPrepAction } from '../game/engine/actions.ts';
import { claimDailyReward, continueAfterMissedWish, ensureAssignedDailyWish } from '../game/engine/daily.ts';
import { addItem, inventoryCount } from '../game/engine/inventory.ts';
import { createInitialState } from '../game/engine/state.ts';
import { PREP_DAY_START } from '../game/engine/time.ts';
import type { DailyWishId } from '../game/types.ts';

function plannedPrep(wishId: DailyWishId) {
  const state = createInitialState(`daily-${wishId}`);
  state.currentEventId = undefined;
  state.dailyPlan = undefined;
  return ensureAssignedDailyWish(state, wishId);
}

test('开局直接指定一项当天可完成的愿望，不要求额外选择或设置时限', () => {
  const state = createInitialState('daily-assigned');
  assert.ok(state.dailyPlan);
  assert.equal(state.dailyPlan?.dayKey, 'prep:1');
  assert.equal(state.dailyPlan?.deadlineId, 'open');

  state.money = 0;
  state.dailyPlan = undefined;
  const reassigned = ensureAssignedDailyWish(state);
  assert.notEqual(reassigned.dailyPlan?.wishId, 'prep-home');
});

test('愿望首次达成后日终只发愿望奖励，不再固定发放每日 +1', () => {
  const state = plannedPrep('prep-income');
  const worked = performPrepAction(state, 'work');
  assert.equal(worked.ok, true);
  assert.equal(worked.state.dailyPlan?.completedAtMinutes, PREP_DAY_START + 240);

  const settled = endDay(worked.state);
  assert.equal(settled.ok, true);
  assert.equal(settled.state.dailySettlement?.wishAchieved, true);
  assert.equal(settled.state.dailySettlement?.basePoints, 0);
  assert.equal(settled.state.dailySettlement?.earnedPoints, 2);
  assert.equal(settled.state.dailyPoints, 2);
  assert.equal(settled.state.feedback.some((item) => item.label === '愿望点'), false);
});

test('未完成愿望奖励为零、没有惩罚，并可直接继续到自动指定的新愿望', () => {
  const state = plannedPrep('prep-income');
  state.dailyPoints = 4;
  const settled = endDay(state).state;
  assert.equal(settled.dailySettlement?.wishAchieved, false);
  assert.equal(settled.dailySettlement?.earnedPoints, 0);
  assert.equal(settled.dailyPoints, 4);
  assert.ok(settled.logs.some((log) => log.body.includes('没有获得奖励，也没有任何损失')));

  const continued = continueAfterMissedWish(settled);
  assert.equal(continued.ok, true);
  assert.equal(continued.state.dailyPoints, 4);
  assert.equal(continued.state.dailySettlement, undefined);
  assert.equal(continued.state.dailyPlan?.dayKey, 'prep:2');
});

test('刚好抵达日终的最后一个行动仍计入愿望，待处理日结不能重复结算', () => {
  const state = plannedPrep('prep-income');
  state.clockMinutes = 18 * 60;
  const settled = performPrepAction(state, 'work');
  assert.equal(settled.ok, true);
  assert.equal(settled.state.prepDay, 2);
  assert.equal(settled.state.dailySettlement?.wishAchieved, true);
  assert.equal(settled.state.dailySettlement?.completedAtMinutes, 22 * 60);
  assert.equal(settled.state.dailyPoints, 2);

  const snapshot = structuredClone(settled.state);
  const duplicate = endDay(settled.state);
  assert.equal(duplicate.ok, false);
  assert.deepEqual(duplicate.state, snapshot);
  assert.equal(duplicate.state.logs.filter((log) => log.title === '每日愿望结算').length, 1);
});

test('达成后可以选奖励；点数不足时状态完全不变', () => {
  const state = plannedPrep('prep-income');
  const settled = endDay(performPrepAction(state, 'work').state).state;
  settled.dailySettlement!.rewardChoices = ['quiet-rest', 'repair-kit', 'food-cache'];
  const snapshot = structuredClone(settled);
  const blocked = claimDailyReward(settled, 'repair-kit');
  assert.equal(blocked.ok, false);
  assert.deepEqual(blocked.state, snapshot);

  const rewarded = claimDailyReward(settled, 'quiet-rest');
  assert.equal(rewarded.ok, true);
  assert.equal(rewarded.state.dailyPoints, 1);
  assert.equal(rewarded.state.dailySettlement, undefined);
  assert.equal(rewarded.state.dailyPlan?.dayKey, 'prep:2');
});

test('日结日志只出现一次，并排在下一天日志之前', () => {
  const state = plannedPrep('prep-contact');
  const settled = endDay(state).state;
  const settlementIndex = settled.logs.findIndex((log) => log.title === '每日愿望结算');
  const nextDayIndex = settled.logs.findIndex((log) => log.title === '一天结束');
  assert.equal(settled.logs.filter((log) => log.title === '每日愿望结算').length, 1);
  assert.ok(settlementIndex >= 0 && nextDayIndex > settlementIndex);
  assert.equal(new Set(settled.logs.map((log) => log.id)).size, settled.logs.length);
});

test('灾前进入新一天也会移除已经腐烂的批次', () => {
  const state = plannedPrep('prep-contact');
  state.inventory = addItem(state.inventory, ITEM_MAP['fresh-apples'], 1, 1);
  state.inventory['fresh-apples'][0].expiresOn = 1;
  const settled = endDay(state).state;
  assert.equal(settled.prepDay, 2);
  assert.equal(inventoryCount(settled.inventory, 'fresh-apples'), 0);
  assert.ok(settled.logs.some((log) => log.body.includes('已经腐烂')));
});
