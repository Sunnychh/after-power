import test from 'node:test';
import assert from 'node:assert/strict';
import { repayDebt } from '../game/engine/actions.ts';
import { assessDebtNight, debtRiskBonus } from '../game/engine/loan.ts';
import { createInitialState, rollDanger } from '../game/engine/state.ts';
import { SURVIVAL_DAY_START } from '../game/engine/time.ts';
import { activateDay } from './helpers.ts';

function survivalLoan(tier: 'bridge' | 'desperate' = 'bridge') {
  const state = createInitialState('loan-test', [], 0, 'normal', false, tier);
  state.phase = 'survival';
  state.prepDay = 7;
  state.survivalDay = 1;
  state.clockMinutes = SURVIVAL_DAY_START;
  state.currentEventId = undefined;
  return activateDay(state, 'survival-care');
}

test('开局借贷同时增加现金和明确债务，不借贷则没有债务', () => {
  const plain = createInitialState('loan-start', [], 0, 'normal', false, 'none');
  const bridge = createInitialState('loan-start', [], 0, 'normal', false, 'bridge');
  const desperate = createInitialState('loan-start', [], 0, 'normal', false, 'desperate');
  assert.equal(plain.debt, undefined);
  assert.equal(bridge.money - plain.money, 280);
  assert.equal(bridge.debt?.balance, 360);
  assert.equal(desperate.money - plain.money, 520);
  assert.equal(desperate.debt?.balance, 760);
});

test('未结债务提高危险判定，逾期次数会继续增加风险', () => {
  const plain = survivalLoan();
  plain.debt = undefined;
  const indebted = survivalLoan();
  const overdue = survivalLoan();
  overdue.debt!.missedCollections = 3;
  const a = rollDanger(plain, 35);
  const b = rollDanger(indebted, 35);
  const c = rollDanger(overdue, 35);
  assert.equal(a.roll, b.roll);
  assert.equal(b.roll, c.roll);
  assert.ok(a.risk < b.risk && b.risk < c.risk);
});

test('最低还款扣除现金、债务与三十分钟，结清后移除风险', () => {
  let state = survivalLoan();
  state.money = 500;
  const minimum = repayDebt(state, 'minimum');
  assert.equal(minimum.ok, true);
  assert.equal(minimum.state.money, 420);
  assert.equal(minimum.state.debt?.balance, 280);
  assert.equal(minimum.state.clockMinutes, SURVIVAL_DAY_START + 30);
  assert.ok(minimum.state.feedback.some((item) => item.label === '时间' && item.delta === 30));
  state = minimum.state;
  const cleared = repayDebt(state, 'all');
  assert.equal(cleared.ok, true);
  assert.equal(cleared.state.money, 140);
  assert.equal(cleared.state.debt, undefined);
  assert.equal(debtRiskBonus(cleared.state), 0);
});

test('到期前只提醒，到期后逐夜增加费用并产生催收损害', () => {
  let state = survivalLoan('bridge');
  state.survivalDay = 4;
  const reminder = assessDebtNight(state);
  assert.equal(reminder.debt?.balance, 360);
  assert.ok(reminder.logs.some((log) => log.title === '催收提醒'));
  state = reminder;
  state.survivalDay = 5;
  const first = assessDebtNight(state);
  assert.equal(first.debt?.balance, 388);
  assert.equal(first.debt?.missedCollections, 1);
  state = first;
  state.survivalDay = 6;
  const integrity = state.shelter.integrity;
  const second = assessDebtNight(state);
  assert.equal(second.debt?.balance, 416);
  assert.equal(second.debt?.missedCollections, 2);
  assert.equal(second.shelter.integrity, integrity - 3);
});
