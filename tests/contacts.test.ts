import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_MAP } from '../game/data/items.ts';
import { endDay, performSurvivalAction } from '../game/engine/actions.ts';
import { activeContactDisabledReason, contactDayFlag, contactsRemainingToday, npcAllianceFlag, performActiveContact } from '../game/engine/contacts.ts';
import { addItem, inventoryCount } from '../game/engine/inventory.ts';
import { siegeMitigation } from '../game/engine/siege.ts';
import { dangerRisk, createInitialState } from '../game/engine/state.ts';
import { SURVIVAL_DAY_START } from '../game/engine/time.ts';
import type { GameState } from '../game/types.ts';
import { activateDay } from './helpers.ts';

function contactState(seed = 'active-contact'): GameState {
  const state = activateDay(createInitialState(seed, [], 0, 'hard'), 'survival-care');
  state.phase = 'survival';
  state.prepDay = 7;
  state.survivalDay = 9;
  state.clockMinutes = SURVIVAL_DAY_START;
  state.currentEventId = undefined;
  state.broadcasts = 4;
  state.shelter.power = 3;
  state.inventory = addItem(state.inventory, ITEM_MAP.radio, 1, 8);
  return state;
}

test('玩家可主动选择已解锁人物，通讯真实消耗电力和时间且每日限一次', () => {
  const state = contactState();
  const result = performActiveContact(state, 'chen-meng', 'consult');
  assert.equal(result.ok, true);
  assert.equal(result.state.clockMinutes, SURVIVAL_DAY_START + 45);
  assert.equal(result.state.shelter.power, 1);
  assert.equal(result.state.intel, state.intel + 1);
  assert.equal(result.state.relationships['chen-meng'], 2);
  assert.ok(result.state.flags.includes(contactDayFlag(state, 'chen-meng')));
  assert.match(activeContactDisabledReason(result.state, 'chen-meng', 'support') ?? '', /今天已经主动联络/);
});

test('没有电力时依次使用电池或手摇发电，不会凭空完成通讯', () => {
  const battery = contactState('contact-battery');
  battery.shelter.power = 0;
  battery.inventory = addItem(battery.inventory, ITEM_MAP.batteries, 1, 8);
  const batteryResult = performActiveContact(battery, 'qiu-lan', 'consult');
  assert.equal(inventoryCount(batteryResult.state.inventory, 'batteries'), 0);
  assert.equal(batteryResult.state.clockMinutes, SURVIVAL_DAY_START + 45);

  const crank = contactState('contact-crank');
  crank.shelter.power = 0;
  const crankResult = performActiveContact(crank, 'lin-zhou', 'consult');
  assert.equal(crankResult.state.clockMinutes, SURVIVAL_DAY_START + 75);
  assert.equal(crankResult.state.stats.stamina, crank.stats.stamina - 12);
});

test('提供物资会严格扣除库存并增长对应人物信任', () => {
  const state = contactState('contact-support');
  state.inventory = addItem(state.inventory, ITEM_MAP['water-bottle'], 1, 8);
  const before = inventoryCount(state.inventory, 'water-bottle');
  const result = performActiveContact(state, 'chen-meng', 'support');
  assert.equal(result.ok, true);
  assert.equal(inventoryCount(result.state.inventory, 'water-bottle'), before - 1);
  assert.equal(result.state.relationships['chen-meng'], 7);
});

test('信任达标后可主动邀请结盟，四种职业能力产生实际效果', () => {
  const chen = contactState('ally-chen');
  chen.relationships['chen-meng'] = 24;
  const baseMitigation = siegeMitigation(chen);
  const chenAllied = performActiveContact(chen, 'chen-meng', 'alliance').state;
  assert.ok(chenAllied.flags.includes(npcAllianceFlag('chen-meng')));
  assert.equal(siegeMitigation(chenAllied), baseMitigation + 2);

  const qiu = contactState('ally-qiu');
  const baseRisk = dangerRisk(qiu, 40).risk;
  qiu.relationships['qiu-lan'] = 24;
  const qiuAllied = performActiveContact(qiu, 'qiu-lan', 'alliance').state;
  assert.equal(dangerRisk(qiuAllied, 40).risk, baseRisk - 3);

  const pan = contactState('ally-pan');
  pan.relationships['pan-yue'] = 24;
  pan.shelter.integrity = 50;
  const panAllied = performActiveContact(pan, 'pan-yue', 'alliance').state;
  panAllied.shelter.integrity = 50;
  panAllied.inventory = addItem(panAllied.inventory, ITEM_MAP.toolkit, 1, 8);
  panAllied.inventory = addItem(panAllied.inventory, ITEM_MAP['duct-tape'], 1, 8);
  const repaired = performSurvivalAction(panAllied, 'repair');
  assert.equal(repaired.state.shelter.integrity, 69);

  const lin = contactState('ally-lin');
  lin.relationships['lin-zhou'] = 24;
  const linAllied = performActiveContact(lin, 'lin-zhou', 'alliance').state;
  assert.ok(linAllied.flags.includes(npcAllianceFlag('lin-zhou')));
  linAllied.injuries = ['外伤', '感染迹象'];
  linAllied.stats.health = 80;
  linAllied.stats.satiety = 100;
  linAllied.stats.hydration = 100;
  const withoutTalent = structuredClone(linAllied);
  withoutTalent.flags = withoutTalent.flags.filter((flag) => flag !== npcAllianceFlag('lin-zhou'));
  const alliedNight = endDay(linAllied).state;
  const ordinaryNight = endDay(withoutTalent).state;
  assert.equal(alliedNight.stats.health, ordinaryNight.stats.health + 2);
});

test('艰难难度主动联络按全局每日两次封顶，咨询不会凭空恢复健康或房屋', () => {
  let state = contactState('contact-global-budget');
  state.shelter.power = 10;
  state.stats.health = 50;
  state.shelter.integrity = 50;
  const healthBefore = state.stats.health;
  const integrityBefore = state.shelter.integrity;
  state = performActiveContact(state, 'lin-zhou', 'consult').state;
  state = performActiveContact(state, 'pan-yue', 'consult').state;
  assert.equal(state.stats.health, healthBefore);
  assert.equal(state.shelter.integrity, integrityBefore);
  assert.equal(contactsRemainingToday(state), 0);
  assert.match(activeContactDisabledReason(state, 'qiu-lan', 'consult') ?? '', /联络额度已用完/);
});

test('未通过广播解锁人物时不能绕过联络顺序', () => {
  const state = contactState('contact-locked');
  state.broadcasts = 1;
  assert.match(activeContactDisabledReason(state, 'qiu-lan', 'consult') ?? '', /尚未通过广播/);
});
