import { DIFFICULTY_MAP } from '../data/difficulties.ts';
import { ITEM_MAP, ITEMS } from '../data/items.ts';
import type { GameState, Inventory, ItemDefinition } from '../types.ts';
import { createDailySettlement, dailyActionBlockedReason, recordDailyAction } from './daily.ts';
import { determineOutcome, finishRun } from './outcomes.ts';
import { expireItems, inventoryCount, removeItem } from './inventory.ts';
import { assessDebtNight } from './loan.ts';
import { absoluteDay, addFlag, applyEffect, createLog, selectEvent, weatherForDay } from './state.ts';
import { dayEndMinutes, PREP_DAY_START, SURVIVAL_DAY_START } from './time.ts';

export type EngineResult = { state: GameState; ok: boolean; message?: string };

function findRation(state: GameState, tag: 'food' | 'water'): ItemDefinition | undefined {
  return ITEMS
    .filter((item) => item.tags?.includes(tag) && inventoryCount(state.inventory, item.id) > 0)
    .sort((a, b) => {
      const aExpiry = Math.min(...(state.inventory[a.id] ?? []).map((batch) => batch.expiresOn ?? Infinity));
      const bExpiry = Math.min(...(state.inventory[b.id] ?? []).map((batch) => batch.expiresOn ?? Infinity));
      if (aExpiry !== bExpiry) return aExpiry - bExpiry;
      const aRestore = tag === 'food' ? a.effects?.satiety ?? 0 : a.effects?.hydration ?? 0;
      const bRestore = tag === 'food' ? b.effects?.satiety ?? 0 : b.effects?.hydration ?? 0;
      return aRestore - bRestore;
    })[0];
}

function consumeRation(state: GameState, item: ItemDefinition, reason: string): GameState {
  const removed = removeItem(state.inventory, item.id, 1);
  if (!removed) return state;
  let next = { ...structuredClone(state), inventory: removed };
  next = applyEffect(next, { stats: item.effects }, reason);
  next.feedback.push({ id: `${next.runId}-ration-${next.logs.length}-${item.id}`, label: item.name, delta: -1, reason });
  return next;
}

export function extendColdStorage(inventory: Inventory, currentDay: number): { inventory: Inventory; preserved: number } {
  const next = structuredClone(inventory);
  let preserved = 0;
  for (const [itemId, batches] of Object.entries(next)) {
    if (!ITEM_MAP[itemId]?.perishableDays) continue;
    for (const batch of batches) {
      if (batch.expiresOn !== undefined && batch.expiresOn >= currentDay) {
        batch.expiresOn += 1;
        preserved += batch.quantity;
      }
    }
  }
  return { inventory: next, preserved };
}

export function completeTimedAction(state: GameState, durationMinutes: number, actionId = 'timed-action'): EngineResult {
  let next = structuredClone(state);
  next.clockMinutes += durationMinutes;
  next.feedback.push({ id: `${next.runId}-time-${next.logs.length}-${next.clockMinutes}`, label: '时间', delta: durationMinutes, reason: '行动耗时' });
  next = recordDailyAction(next, actionId);
  const outcome = determineOutcome(next);
  if (outcome) return { state: finishRun(next, outcome), ok: true };
  if (next.clockMinutes >= dayEndMinutes(next)) return endDay(next, true);
  return { state: next, ok: true };
}

export function endDay(state: GameState, reachedByClock = false): EngineResult {
  if (state.currentEventId) return { state, ok: false, message: '先处理眼前的事件。' };
  const dailyReason = dailyActionBlockedReason(state);
  if (dailyReason) return { state, ok: false, message: dailyReason };
  const beforeNight = structuredClone(state);
  if (state.phase === 'prep') {
    let next = structuredClone(state);
    next.shoppingTrip = undefined;
    if (!reachedByClock && next.clockMinutes < dayEndMinutes(next)) {
      next.logs = [...next.logs, createLog(next, '提前就寝', '你关掉清单，给明天留出一副清醒的脑子。', 'system')];
    }
    next = applyEffect(next, { stats: { stamina: 24, morale: 1 } }, '灾前夜间休息');
    if (next.prepDay >= 7) {
      next.phase = 'survival';
      next.survivalDay = 1;
      next.clockMinutes = SURVIVAL_DAY_START;
      next.weather = weatherForDay(next, 1);
      next.currentEventId = selectEvent(next)?.id;
      next = createDailySettlement(beforeNight, next, false);
      next.logs = [...next.logs, createLog(next, '00:17 · 全城停电', '路灯沿街依次熄灭。手机信号只剩一格，窗外响起第一辆封锁车的扩音器。你锁上门，灾前准备到此为止。', 'bad')];
    } else {
      next.prepDay += 1;
      next.clockMinutes = PREP_DAY_START;
      next.currentEventId = selectEvent(next)?.id;
      next = createDailySettlement(beforeNight, next, false);
      next.logs = [...next.logs, createLog(next, '一天结束', `距离封锁还有 ${8 - next.prepDay} 天。你重新核对清单，把缺口留到明天。`, 'system')];
    }
    next = removeExpiredForCurrentDay(next);
    return { state: next, ok: true };
  }
  if (state.phase !== 'survival') return { state, ok: false, message: '本轮已经结束。' };

  let next = structuredClone(state);
  next.feedback = [];
  if (!reachedByClock && next.clockMinutes < dayEndMinutes(next)) {
    next.logs = [...next.logs, createLog(next, '提前就寝', '你检查门锁，把剩余的白昼留给休息。', 'system')];
  }

  const config = DIFFICULTY_MAP[next.difficulty];
  const foodDrain = Math.round(18 * config.nightCostMultiplier);
  const waterDrain = Math.round(24 * config.nightCostMultiplier);
  const staminaGain = next.difficulty === 'easy' ? 32 : next.difficulty === 'hard' ? 22 : 26;
  const moraleDrain = next.difficulty === 'easy' ? 0 : next.difficulty === 'hard' ? 4 : 2;
  const food = next.autoRations ? findRation(next, 'food') : undefined;
  const water = next.autoRations ? findRation(next, 'water') : undefined;
  next = applyEffect(next, { stats: { satiety: -foodDrain, hydration: -waterDrain, stamina: staminaGain, morale: -moraleDrain } }, '夜间基础消耗');
  const consumed: string[] = [];
  if (next.autoRations && next.stats.satiety < 60 && food) {
    next = consumeRation(next, food, '夜间配给');
    consumed.push(food.name);
  }
  if (next.autoRations && next.stats.hydration < 60 && water) {
    next = consumeRation(next, water, '夜间配给');
    consumed.push(water.name);
  } else if (next.autoRations && next.stats.hydration < 60 && next.shelter.water >= 4) {
    next = applyEffect(next, { shelter: { water: -4 }, stats: { hydration: 24 } }, '使用水箱储水');
    consumed.push('水箱储水');
  }

  let fridgeText = '';
  if (next.furniture.fridge.enabled && next.shelter.power >= 1) {
    const cold = extendColdStorage(next.inventory, absoluteDay(next));
    next.inventory = cold.inventory;
    next = applyEffect(next, { shelter: { power: -1 } }, '冰箱夜间保鲜');
    next.furniture.fridge.lastUsedDay = absoluteDay(next);
    fridgeText = cold.preserved ? `冰箱为 ${cold.preserved} 件易腐物资延长了 1 天保质期。` : '冰箱保持低功率运行。';
  } else if (Object.values(next.inventory).some((batches) => batches.some((batch) => batch.expiresOn !== undefined))) {
    fridgeText = '冰箱没有电，易腐物资继续自然变质。';
  }

  const hadNightLight = next.shelter.power > 0;
  if (hadNightLight) next = applyEffect(next, { shelter: { power: -1 }, stats: { morale: 2 } }, '夜间照明');
  else next = applyEffect(next, { stats: { morale: -3 } }, '完全停电');

  const shelterDamage = (amount: number) => -Math.max(1, Math.round(amount * config.shelterDamageMultiplier));
  if (next.weather === '闷热') next = applyEffect(next, { stats: { hydration: -Math.round(7 * config.nightCostMultiplier), stamina: -3 } }, '闷热天气');
  if (next.weather === '暴雨') next = applyEffect(next, { shelter: { integrity: shelterDamage(7), power: -1 } }, '暴雨冲刷');
  if (next.weather === '酸雨') next = applyEffect(next, { shelter: { integrity: shelterDamage(4) } }, '酸雨腐蚀');
  if (next.weather === '寒潮') {
    if (next.shelter.fuel >= 2) next = applyEffect(next, { shelter: { fuel: -2 }, stats: { morale: 2 } }, '寒潮取暖');
    else next = applyEffect(next, { stats: { health: -5, morale: -3 } }, '寒潮失温');
  }
  if (next.injuries.includes('外伤')) next = applyEffect(next, { stats: { health: -3 } }, '未处理外伤');
  if (next.injuries.includes('感染迹象')) next = applyEffect(next, { stats: { health: -5 } }, '感染加重');
  if (next.stats.satiety < 20) next = applyEffect(next, { stats: { health: next.stats.satiety === 0 ? -15 : -8 } }, '严重饥饿');
  if (next.stats.hydration < 20) next = applyEffect(next, { stats: { health: next.stats.hydration === 0 ? -22 : -12 } }, '严重脱水');

  next = assessDebtNight(next);

  next.logs = [...next.logs, createLog(
    next,
    `${next.weather} · 夜间结算`,
    `基础消耗：饱腹 -${foodDrain}，水分 -${waterDrain}。${!next.autoRations ? '自动补充已关闭，请在白天自行使用食物和饮水。' : consumed.length ? `自动配给：${consumed.join('、')}。` : '已开启自动补充，但当前无需或没有可用配给。'}${hadNightLight ? '留了一盏灯。' : '屋里整夜没有电。'}${fridgeText}`,
    next.stats.health < 35 ? 'bad' : 'system',
  )];

  const finalNight = next.survivalDay >= config.survivalGoalDays;
  if (finalNight) {
    addFlag(next, 'survived-goal-night');
    addFlag(next, 'evacuation-choice-pending');
  }
  const outcome = determineOutcome(next);
  if (outcome) return { state: finishRun(next, outcome), ok: true };

  if (finalNight) return { state: createDailySettlement(beforeNight, next, true), ok: true };

  next.survivalDay += 1;
  next.clockMinutes = SURVIVAL_DAY_START;
  next.weather = weatherForDay(next, next.survivalDay);
  next = createDailySettlement(beforeNight, next, false);
  next = removeExpiredForCurrentDay(next);
  next.currentEventId = selectEvent(next)?.id;
  return { state: next, ok: true };
}

function removeExpiredForCurrentDay(state: GameState): GameState {
  const next = structuredClone(state);
  const expired = expireItems(next.inventory, absoluteDay(next));
  next.inventory = expired.inventory;
  for (const [itemId, quantity] of Object.entries(expired.expired)) {
    const item = ITEM_MAP[itemId];
    const result = item?.expiredLabel ?? (item?.category === '食物' ? '已经腐烂' : '已经失效');
    next.logs.push(createLog(next, '物资到期', `${item?.name ?? itemId} ×${quantity} ${result}，已从可用物资中移除。`, 'bad'));
  }
  return next;
}
