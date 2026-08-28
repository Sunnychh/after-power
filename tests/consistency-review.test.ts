import test from 'node:test';
import assert from 'node:assert/strict';
import { EVENT_MAP } from '../game/data/events.ts';
import { ITEM_MAP } from '../game/data/items.ts';
import { eventOptionDisabledReason, performSurvivalAction, resolveCurrentEvent } from '../game/engine/actions.ts';
import { endDay } from '../game/engine/day.ts';
import { addItem, inventoryCount } from '../game/engine/inventory.ts';
import { survivalNeedAlert } from '../game/engine/needs.ts';
import { loadGame, saveGame } from '../game/engine/save.ts';
import { forecastNightPowerBudget, nightPowerBudget } from '../game/engine/siege.ts';
import { absoluteDay, createInitialState, dangerRisk, GAME_SAVE_KEY, isEventEligible } from '../game/engine/state.ts';
import type { GameState, StorageLike } from '../game/types.ts';
import { SURVIVAL_DAY_START } from '../game/engine/time.ts';
import { activateDay } from './helpers.ts';

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

function survivalState(seed: string, difficulty: GameState['difficulty'] = 'normal', day = 1): GameState {
  const state = createInitialState(seed, [], 0, difficulty, false);
  state.phase = 'survival';
  state.prepDay = 7;
  state.survivalDay = day;
  state.clockMinutes = SURVIVAL_DAY_START;
  state.currentEventId = undefined;
  state.weather = '晴冷';
  state.shelter.integrity = 100;
  return activateDay(state, 'survival-care');
}

test('玩家没有收音机时广播事件不合格，旧存档中的悬空广播事件会被清理', () => {
  const state = survivalState('radio-gate', 'normal', 7);
  assert.equal(inventoryCount(state.inventory, 'radio'), 0);
  assert.equal(isEventEligible(state, EVENT_MAP['radio-choir']), false);
  state.inventory = addItem(state.inventory, ITEM_MAP.radio, 1, absoluteDay(state));
  assert.equal(isEventEligible(state, EVENT_MAP['radio-choir']), true);

  const storage = new MemoryStorage();
  const stale = survivalState('stale-radio', 'normal', 7);
  stale.currentEventId = 'radio-choir';
  saveGame(storage, stale);
  assert.equal(loadGame(storage)?.currentEventId, undefined);

  const malformed = structuredClone(stale) as unknown as Record<string, unknown>;
  malformed.currentEventId = 'removed-event';
  delete malformed.feedback;
  storage.setItem(GAME_SAVE_KEY, JSON.stringify(malformed));
  const restored = loadGame(storage);
  assert.ok(restored);
  assert.equal(restored?.currentEventId, undefined);
  assert.deepEqual(restored?.feedback, []);
});

test('广播事件除了收音机本体还需要真实供能，并结算接收成本', () => {
  const dead = survivalState('dead-radio', 'normal', 7);
  dead.inventory = addItem(dead.inventory, ITEM_MAP.radio, 1, absoluteDay(dead));
  dead.shelter.power = 0;
  dead.stats.stamina = 8;
  assert.equal(isEventEligible(dead, EVENT_MAP['radio-choir']), false);

  const cranked = structuredClone(dead);
  cranked.stats.stamina = 9;
  assert.equal(isEventEligible(cranked, EVENT_MAP['radio-choir']), true);
  cranked.currentEventId = 'radio-choir';
  const resolved = resolveCurrentEvent(cranked, 2);
  assert.equal(resolved.ok, true);
  assert.equal(resolved.state.stats.stamina, 1);
  assert.match(resolved.state.logs.at(-1)?.body ?? '', /手摇供电，体力 -8/);
});

test('只有真实交流的事件选项会刷新联络日，涉及玩家收音机的选项也有物品前置', () => {
  const trade = survivalState('radio-option', 'normal', 3);
  trade.currentEventId = 'battery-trade';
  assert.match(eventOptionDisabledReason(trade, 1) ?? '', /短波收音机/);

  const alone = survivalState('choice-contact-alone', 'normal', 12);
  alone.currentEventId = 'night-silence';
  alone.lastContactDay = absoluteDay(alone) - 3;
  const slept = resolveCurrentEvent(alone, 2).state;
  assert.equal(slept.lastContactDay, alone.lastContactDay, '独自睡觉不能被记录成与人交流');

  const social = survivalState('choice-contact-social', 'normal', 12);
  social.currentEventId = 'night-silence';
  social.lastContactDay = absoluteDay(social) - 3;
  const spoke = resolveCurrentEvent(social, 1).state;
  assert.equal(spoke.lastContactDay, absoluteDay(social));

  const soloNpcScene = survivalState('npc-is-not-contact', 'normal', 3);
  soloNpcScene.currentEventId = 'fridge-last-meal';
  soloNpcScene.lastContactDay = absoluteDay(soloNpcScene) - 3;
  const discarded = resolveCurrentEvent(soloNpcScene, 2).state;
  assert.equal(discarded.lastContactDay, soloNpcScene.lastContactDay, '仅用 NPC 作为事件前置不能伪造本次真人交流');
});

test('困难后期自动补给在库存足够时补到目标线，并在瓶装饮料后继续使用净水箱', () => {
  const state = survivalState('auto-target', 'hard', 13);
  state.autoRations = true;
  state.stats.satiety = 45;
  state.stats.hydration = 45;
  state.shelter.water = 4;
  state.shelter.reinforcement = 20;
  state.inventory = addItem({}, ITEM_MAP.crackers, 3, absoluteDay(state));
  state.inventory = addItem(state.inventory, ITEM_MAP['canned-soda'], 3, absoluteDay(state));
  const settled = endDay(state).state;
  assert.ok(settled.stats.satiety >= 60);
  assert.ok(settled.stats.hydration >= 60);
  assert.equal(settled.shelter.water, 1, '每单位净水恢复 7 点后，只需取用三单位即可达到目标线');
  assert.match(settled.logs.findLast((log) => log.title.includes('夜间结算'))?.body ?? '', /自动配给至目标线/);
});

test('自动补给预警会计入干粮的负水分，不能把账面总量误报为足够', () => {
  const state = survivalState('dry-ration-warning', 'hard', 13);
  state.autoRations = true;
  state.stats.satiety = 60;
  state.stats.hydration = 80;
  state.shelter.water = 0;
  state.inventory = addItem({}, ITEM_MAP.crackers, 2, absoluteDay(state));
  state.inventory = addItem(state.inventory, ITEM_MAP['sports-drink'], 1, absoluteDay(state));
  const alert = survivalNeedAlert(state);
  assert.ok(alert);
  assert.equal(alert.rationCanCover, false);
  assert.match(alert.detail, /不足以补到 60/);
});

test('严重饥渴会显著警告、降低心态和睡眠恢复，并进入危险判定', () => {
  const state = survivalState('need-stress', 'hard', 3);
  state.stats.satiety = 20;
  state.stats.hydration = 20;
  state.stats.morale = 60;
  state.stats.stamina = 50;
  const alert = survivalNeedAlert(state);
  assert.equal(alert?.severity, 'critical');
  assert.match(alert?.detail ?? '', /提高危险率/);
  const risk = dangerRisk(state, 30);
  assert.ok(risk.factors.some((factor) => factor.label === '严重饥饿'));
  assert.ok(risk.factors.some((factor) => factor.label === '严重缺水'));

  const settled = endDay(state).state;
  assert.ok(settled.stats.morale <= 46, '基础压力与饥渴心理压力都应结算');
  assert.ok(settled.stats.stamina < 72, '饥渴应抵消一部分睡眠恢复');
  assert.match(settled.logs.findLast((log) => log.title.includes('夜间结算'))?.body ?? '', /严重饥渴造成健康/);
});

test('危机耐受真实降低低精神危险加成', () => {
  const plain = survivalState('steady-plain');
  plain.stats.morale = 20;
  const steady = survivalState('steady-active');
  steady.stats.morale = 20;
  steady.flags.push('ability:steady');
  assert.equal(dangerRisk(plain, 30).risk - dangerRisk(steady, 30).risk, 4);
});

test('原水不能直接饮用，净化后才进入瓶装水库存', () => {
  const state = survivalState('raw-water');
  state.shelter.water = 0;
  state.shelter.rawWater = 6;
  assert.equal(performSurvivalAction(state, 'drink-storage').ok, false);
  state.inventory = addItem(state.inventory, ITEM_MAP['purifier-tablet'], 1, absoluteDay(state));
  state.inventory = addItem(state.inventory, ITEM_MAP['filter-cloth'], 1, absoluteDay(state));
  const purified = performSurvivalAction(state, 'purify');
  assert.equal(purified.ok, true);
  assert.equal(purified.state.shelter.rawWater, 0);
  assert.equal(inventoryCount(purified.state.inventory, 'water-bottle'), 2);
});

test('带锈水泵事件只增加原水，不会绕过净化流程', () => {
  const state = survivalState('rust-pump', 'normal', 2);
  state.currentEventId = 'pump-restart';
  state.shelter.power = 4;
  const resolved = resolveCurrentEvent(state, 0);
  assert.equal(resolved.ok, true);
  assert.equal(resolved.state.shelter.water, 0);
  assert.equal(resolved.state.shelter.rawWater, 14);
  assert.equal(performSurvivalAction(resolved.state, 'drink-storage').ok, false);
});

test('陷阱优先预留电力，预览预算与第八夜实际攻击一致', () => {
  const state = survivalState('power-budget', 'hard', 8);
  state.autoRations = false;
  state.powerPolicy = 'balanced';
  state.powerTrap = { level: 3, armed: true };
  state.shelter.power = 5;
  state.shelter.reinforcement = 20;
  state.inventory = addItem(state.inventory, ITEM_MAP['fresh-apples'], 1, absoluteDay(state));
  const budget = nightPowerBudget(state);
  assert.deepEqual({ attack: budget.trapAttack, trap: budget.trapSpend, alarm: budget.alarmSpend, policy: budget.policySpend, total: budget.totalSpend }, { attack: 16, trap: 4, alarm: 1, policy: 0, total: 5 });
  const settled = endDay(state).state;
  assert.equal(settled.shelter.power, 0);
  assert.match(settled.logs.findLast((log) => log.title.includes('第 8 夜'))?.body ?? '', /主动攻击 16/);
});

test('暴雨与未来波次都使用同一陷阱电力预算', () => {
  const rainy = survivalState('rainy-trap', 'hard', 8);
  rainy.weather = '暴雨';
  rainy.powerPolicy = 'balanced';
  rainy.powerTrap = { level: 1, armed: true };
  rainy.shelter.power = 3;
  rainy.shelter.reinforcement = 20;
  const rainyBudget = nightPowerBudget(rainy);
  assert.deepEqual(
    { weather: rainyBudget.weatherSpend, trap: rainyBudget.trapSpend, attack: rainyBudget.trapAttack, policy: rainyBudget.policySpend, total: rainyBudget.totalSpend },
    { weather: 1, trap: 2, attack: 5, policy: 0, total: 3 },
  );
  const settled = endDay(rainy).state;
  assert.equal(settled.shelter.power, 0);
  assert.match(settled.logs.findLast((log) => log.title.includes('第 8 夜'))?.body ?? '', /主动攻击 5/);

  const future = survivalState('future-trap', 'hard', 2);
  future.powerPolicy = 'off';
  future.powerTrap = { level: 1, armed: true };
  future.shelter.power = 10;
  const futureBudget = nightPowerBudget(future, 3);
  assert.equal(futureBudget.trapAttack, 5);
  assert.equal(futureBudget.trapSpend, 2);
});

test('未来波次预演会先扣除已知的前置夜间负载', () => {
  const state = survivalState('future-load-order', 'hard', 2);
  state.powerPolicy = 'balanced';
  state.powerTrap = { level: 1, armed: true };
  state.shelter.power = 2;
  const forecast = forecastNightPowerBudget(state, 3);
  assert.equal(forecast.interveningSpend, 1, '第 2 夜的夜灯会先用电');
  assert.equal(forecast.powerBeforeTarget, 1);
  assert.equal(forecast.budget.trapAttack, 0, '第 3 夜不能再用已在前一夜消耗的电力放电');
});

test('很久以前的一次广播不会永久免疫低精神孤立', () => {
  const state = survivalState('stale-contact', 'normal', 6);
  state.broadcasts = 1;
  state.lastContactDay = absoluteDay(state) - 3;
  state.stats.morale = 0;
  const settled = endDay(state).state;
  assert.equal(settled.isolationNights, 1);
});

test('困难后期与邻居面对面交付物资会刷新联络，独自回避不会', () => {
  const water = survivalState('late-water-contact', 'hard', 10);
  water.currentEventId = 'hard-water-corridor';
  water.inventory = addItem(water.inventory, ITEM_MAP['water-bottle'], 2, absoluteDay(water));
  water.lastContactDay = absoluteDay(water) - 3;
  assert.equal(resolveCurrentEvent(water, 2).state.lastContactDay, absoluteDay(water));

  const food = survivalState('late-food-contact', 'hard', 10);
  food.currentEventId = 'hard-food-watch';
  food.inventory = addItem(food.inventory, ITEM_MAP.crackers, 1, absoluteDay(food));
  food.lastContactDay = absoluteDay(food) - 3;
  assert.equal(resolveCurrentEvent(food, 1).state.lastContactDay, absoluteDay(food));
  const avoided = structuredClone(food);
  avoided.currentEventId = 'hard-food-watch';
  assert.equal(resolveCurrentEvent(avoided, 2).state.lastContactDay, food.lastContactDay);

  const horde = survivalState('horde-contact', 'normal', 8);
  horde.currentEventId = 'horde-night';
  horde.lastContactDay = absoluteDay(horde) - 3;
  assert.equal(resolveCurrentEvent(horde, 0).state.lastContactDay, absoluteDay(horde));
});

test('把冰箱里的食物分给同楼住户才算交流，独自处置不算', () => {
  const state = survivalState('fridge-contact', 'normal', 2);
  state.currentEventId = 'fridge-last-meal';
  state.lastContactDay = absoluteDay(state) - 3;
  assert.equal(resolveCurrentEvent(state, 1).state.lastContactDay, absoluteDay(state));
  const discarded = structuredClone(state);
  discarded.currentEventId = 'fridge-last-meal';
  assert.equal(resolveCurrentEvent(discarded, 2).state.lastContactDay, state.lastContactDay);
});
