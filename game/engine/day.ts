import { DIFFICULTY_MAP } from '../data/difficulties.ts';
import { ITEM_MAP } from '../data/items.ts';
import { POWER_POLICY_MAP } from '../data/power.ts';
import { survivalPressure } from '../data/pressure.ts';
import type { GameState, Inventory } from '../types.ts';
import { createDailySettlement, dailyActionBlockedReason, recordDailyAction } from './daily.ts';
import { determineOutcome, finishRun } from './outcomes.ts';
import { expireItems, inventoryCount } from './inventory.ts';
import { recoverFoodFatigue } from './nutrition.ts';
import { AUTO_RATION_TARGET, consumeAutoRation, findAutoRation, topUpFromStoredWater } from './rations.ts';
import { calculateNightNeedStress } from './needs.ts';
import { assessDebtNight } from './loan.ts';
import { nightPowerBudget, resolveHardSiegeWave } from './siege.ts';
import { absoluteDay, addFlag, applyEffect, createLog, selectEvent, weatherForDay } from './state.ts';
import { dayEndMinutes, PREP_DAY_START, SURVIVAL_DAY_START } from './time.ts';

export type EngineResult = { state: GameState; ok: boolean; message?: string };

function aggregateConsumed(consumed: string[]): string {
  const counts = new Map<string, number>();
  for (const name of consumed) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts].map(([name, quantity]) => quantity > 1 ? `${name} ×${quantity}` : name).join('、');
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
  if (next.phase === 'survival') {
    const pressure = survivalPressure(next.difficulty, next.survivalDay);
    const elapsedBefore = Math.max(0, next.clockMinutes - SURVIVAL_DAY_START);
    const elapsedAfter = Math.max(0, next.clockMinutes + durationMinutes - SURVIVAL_DAY_START);
    const twoHourBlocks = Math.floor(elapsedAfter / 120) - Math.floor(elapsedBefore / 120);
    if (twoHourBlocks > 0) {
      const satietyBefore = next.stats.satiety;
      const hydrationBefore = next.stats.hydration;
      next.stats.satiety = Math.max(0, next.stats.satiety - pressure.activityFoodPerTwoHours * twoHourBlocks);
      next.stats.hydration = Math.max(0, next.stats.hydration - pressure.activityWaterPerTwoHours * twoHourBlocks);
      const foodDelta = next.stats.satiety - satietyBefore;
      const waterDelta = next.stats.hydration - hydrationBefore;
      if (foodDelta) next.feedback.push({ id: `${next.runId}-activity-food-${next.logs.length}-${next.clockMinutes}`, label: '饱腹', delta: foodDelta, reason: `${twoHourBlocks * 2}小时行动消耗` });
      if (waterDelta) next.feedback.push({ id: `${next.runId}-activity-water-${next.logs.length}-${next.clockMinutes}`, label: '水分', delta: waterDelta, reason: `${twoHourBlocks * 2}小时行动消耗` });
      if (foodDelta || waterDelta) {
        next.logs.push(createLog(
          next,
          '白天配给消耗',
          `游戏时钟跨过 ${twoHourBlocks} 个两小时结算点：饱腹 ${foodDelta}，水分 ${waterDelta}。休息能恢复体力，但经过的时间仍需要食物和饮水。`,
          'system',
        ));
      }
    }
  }
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
  if (state.expedition) return { state, ok: false, message: '你还在外面，先返回避难所。' };
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
    const fatigueRecovery = recoverFoodFatigue(next);
    next = fatigueRecovery.state;
    if (fatigueRecovery.boredomRecovered) {
      next.logs.push(createLog(next, '饮食印象淡化', `一夜过去，饮食厌倦自然缓解 ${fatigueRecovery.boredomRecovered} 点；单品和同类口感的熟悉度也略有回落。`, 'system'));
    }
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
  const pressure = survivalPressure(next.difficulty, next.survivalDay);
  const foodDrain = pressure.foodDrain;
  const waterDrain = pressure.waterDrain;
  const staminaGain = pressure.staminaRecovery;
  const moraleDrain = pressure.moraleDrain;
  const baseStatsBefore = { ...next.stats };
  next = applyEffect(next, { stats: { satiety: -foodDrain, hydration: -waterDrain, stamina: staminaGain, morale: -moraleDrain } }, '夜间基础消耗');
  const baseStatsDelta = {
    satiety: next.stats.satiety - baseStatsBefore.satiety,
    hydration: next.stats.hydration - baseStatsBefore.hydration,
    stamina: next.stats.stamina - baseStatsBefore.stamina,
    morale: next.stats.morale - baseStatsBefore.morale,
  };
  const consumed: string[] = [];
  const varietyNotes: string[] = [];
  if (next.autoRations) {
    for (let guard = 0; guard < 8 && next.stats.satiety < AUTO_RATION_TARGET; guard += 1) {
      const food = findAutoRation(next, 'food');
      if (!food) break;
      const ration = consumeAutoRation(next, food, '夜间自动配给');
      if (!ration.consumed) break;
      next = ration.state;
      consumed.push(food.name);
      if (ration.varietyText) varietyNotes.push(ration.varietyText);
    }
    for (let guard = 0; guard < 8 && next.stats.hydration < AUTO_RATION_TARGET; guard += 1) {
      const water = findAutoRation(next, 'water');
      if (!water) break;
      const ration = consumeAutoRation(next, water, '夜间自动配给');
      if (!ration.consumed) break;
      next = ration.state;
      consumed.push(water.name);
    }
  }
  if (next.autoRations && next.stats.hydration < AUTO_RATION_TARGET && next.shelter.water >= 1) {
    const toppedUp = topUpFromStoredWater(next, '使用水箱储水');
    next = toppedUp.state;
    consumed.push(`水箱储水 ${toppedUp.used} 单位`);
  }

  const policy = POWER_POLICY_MAP[next.powerPolicy];
  const powerBefore = next.shelter.power;
  const plannedPower = nightPowerBudget(next);
  const criticalReserve = plannedPower.weatherSpend + plannedPower.trapSpend + plannedPower.alarmSpend;
  const hasPerishables = Object.values(next.inventory).some((batches) => batches.some((batch) => batch.expiresOn !== undefined));
  let powerText = '';
  let fridgeText = '';
  if (next.powerPolicy === 'balanced') {
    if (next.furniture.fridge.enabled && hasPerishables && next.shelter.power - criticalReserve >= 1) {
      const cold = extendColdStorage(next.inventory, absoluteDay(next));
      next.inventory = cold.inventory;
      next = applyEffect(next, { shelter: { power: -1 } }, '均衡供电 · 冰箱');
      next.furniture.fridge.lastUsedDay = absoluteDay(next);
      fridgeText = `冰箱为 ${cold.preserved} 件易腐物资延长了 1 天保质期。`;
    } else if (hasPerishables) fridgeText = '冷藏回路未能启动，易腐物资继续自然变质。';
    if (next.shelter.power - criticalReserve >= 1) {
      next = applyEffect(next, { shelter: { power: -1 }, stats: { morale: 2 } }, '均衡供电 · 夜灯');
      powerText = '夜灯亮到入睡，精神 +2。';
    } else {
      next = applyEffect(next, { stats: { morale: -3 } }, '供电不足');
      powerText = '剩余电力不足以点亮夜灯，精神 -3。';
    }
  } else if (next.powerPolicy === 'cold') {
    if (next.furniture.fridge.enabled && next.shelter.power - criticalReserve >= 2) {
      let cold = extendColdStorage(next.inventory, absoluteDay(next));
      cold = extendColdStorage(cold.inventory, absoluteDay(next));
      next.inventory = cold.inventory;
      next = applyEffect(next, { shelter: { power: -2 }, stats: { morale: -1 } }, '保鲜优先');
      next.furniture.fridge.lastUsedDay = absoluteDay(next);
      fridgeText = hasPerishables ? `独立冷藏回路为易腐物资额外争取了 2 天，精神 -1。` : '冰箱整夜空转；没有易腐物需要保鲜，精神 -1。';
    } else {
      next = applyEffect(next, { stats: { morale: -4 } }, '保鲜供电失败');
      fridgeText = '电力不足 2 点，冰箱没有启动，黑暗使精神 -4。';
    }
  } else if (next.powerPolicy === 'light') {
    if (next.shelter.power - criticalReserve >= 2) {
      next = applyEffect(next, { shelter: { power: -2 }, stats: { morale: 5, stamina: 3 } }, '照明优先');
      powerText = '工作灯与充电排插运行整夜，精神 +5、体力 +3。';
    } else if (next.shelter.power - criticalReserve === 1) {
      next = applyEffect(next, { shelter: { power: -1 }, stats: { morale: 1 } }, '照明优先 · 低电量');
      powerText = '只够维持一盏昏暗小灯，精神 +1。';
    } else {
      next = applyEffect(next, { stats: { morale: -4 } }, '照明供电失败');
      powerText = '照明回路无法启动，精神 -4。';
    }
    if (hasPerishables) fridgeText = '冰箱按策略关闭，易腐物资继续自然变质。';
  } else {
    next = applyEffect(next, { stats: { morale: -4 } }, '彻底节电');
    powerText = '你主动关闭所有备用回路，精神 -4。';
    if (hasPerishables) fridgeText = '冰箱断电，易腐物资继续自然变质。';
  }

  const shelterDamage = (amount: number) => -Math.max(1, Math.round(amount * config.shelterDamageMultiplier));
  if (next.weather === '闷热') next = applyEffect(next, { stats: { hydration: -Math.round(7 * config.nightCostMultiplier), stamina: -3 } }, '闷热天气');
  if (next.weather === '暴雨') next = applyEffect(next, { shelter: { integrity: shelterDamage(7), power: -1 } }, '暴雨冲刷');
  if (next.weather === '酸雨') next = applyEffect(next, { shelter: { integrity: shelterDamage(4) } }, '酸雨腐蚀');
  if (next.weather === '寒潮') {
    if (next.shelter.fuel >= 2) next = applyEffect(next, { shelter: { fuel: -2 }, stats: { morale: 2 } }, '寒潮取暖');
    else next = applyEffect(next, { stats: { health: -5, morale: -3 } }, '寒潮失温');
  }
  // Heat and other late-night drains happen after the first drink; automatic mode gets a final chance to reach its stated target.
  if (next.autoRations && next.stats.hydration < AUTO_RATION_TARGET) {
    for (let guard = 0; guard < 8 && next.stats.hydration < AUTO_RATION_TARGET; guard += 1) {
      const water = findAutoRation(next, 'water');
      if (!water) break;
      const ration = consumeAutoRation(next, water, '夜间自动补水');
      if (!ration.consumed) break;
      next = ration.state;
      consumed.push(water.name);
    }
    if (next.stats.hydration < AUTO_RATION_TARGET && next.shelter.water >= 1) {
      const toppedUp = topUpFromStoredWater(next, '夜间自动补水 · 水箱');
      next = toppedUp.state;
      consumed.push(`水箱储水 ${toppedUp.used} 单位`);
    }
  }
  const alliedWithLin = next.flags.includes('npc-allied:lin-zhou');
  let infectionAdvancedTonight = false;
  if (next.injuries.includes('呼吸道不适')) {
    if (next.flags.includes('respiratory-symptom-night')) {
      next.injuries = next.injuries.filter((injury) => injury !== '呼吸道不适');
      next = applyEffect(next, { stats: { health: -4, morale: -2 }, injury: '感染迹象', removeFlags: ['respiratory-symptom-night'] }, '呼吸道症状恶化');
      infectionAdvancedTonight = true;
      next.logs.push(createLog(next, '症状恶化 · 感染迹象', '连续两夜的咳嗽转为发热和胸闷。抗生素现在能处理这项伤病；继续拖延会每夜损失健康。', 'bad'));
    } else {
      next = applyEffect(next, { stats: { health: -2, morale: -1 }, addFlags: ['respiratory-symptom-night'] }, '呼吸道不适');
    }
  } else {
    next.flags = next.flags.filter((flag) => flag !== 'respiratory-symptom-night');
  }
  if (next.injuries.includes('外伤')) next = applyEffect(next, { stats: { health: alliedWithLin ? -2 : -3 } }, alliedWithLin ? '林舟 · 创伤分级' : '未处理外伤');
  if (next.injuries.includes('感染迹象') && !infectionAdvancedTonight) next = applyEffect(next, { stats: { health: alliedWithLin ? -4 : -5 } }, alliedWithLin ? '林舟 · 创伤分级' : '感染加重');
  const needStress = calculateNightNeedStress(next);
  if (needStress.moralePenalty || needStress.staminaPenalty) {
    next = applyEffect(next, { stats: { morale: -needStress.moralePenalty, stamina: -needStress.staminaPenalty } }, '饥渴与饮食压力');
  }
  const healthBeforeStarvation = next.stats.health;
  if (next.stats.satiety < 20) next = applyEffect(next, { stats: { health: next.stats.satiety === 0 ? -15 : -8 } }, '严重饥饿');
  if (next.stats.hydration < 20) next = applyEffect(next, { stats: { health: next.stats.hydration === 0 ? -22 : -12 } }, '严重脱水');
  const starvationHealthLoss = healthBeforeStarvation - next.stats.health;

  const fatigueRecovery = recoverFoodFatigue(next);
  next = fatigueRecovery.state;

  next.logs = [...next.logs, createLog(
    next,
    `${next.weather} · 夜间结算`,
    `${pressure.name}基础结算（实际变化）：饱腹 ${baseStatsDelta.satiety}，水分 ${baseStatsDelta.hydration}，体力 ${baseStatsDelta.stamina >= 0 ? '+' : ''}${baseStatsDelta.stamina}，精神 ${baseStatsDelta.morale}。${!next.autoRations ? '自动补充已关闭，请在白天自行使用食物和饮水。' : consumed.length ? `自动配给至目标线：${aggregateConsumed(consumed)}。` : '已开启自动补充，但当前无需或没有可用配给。'}${next.autoRations && (next.stats.satiety < AUTO_RATION_TARGET || next.stats.hydration < AUTO_RATION_TARGET) ? `库存不足，结算后仍为饱腹 ${next.stats.satiety}、水分 ${next.stats.hydration}。` : ''}${varietyNotes.slice(-3).join(' ')}${needStress.moralePenalty || needStress.staminaPenalty ? `饥渴/单调压力：精神 -${needStress.moralePenalty}、睡眠恢复抵消 ${needStress.staminaPenalty}（${needStress.reasons.join('；')}）。` : ''}${starvationHealthLoss ? `严重饥渴造成健康 -${starvationHealthLoss}。` : ''}${fatigueRecovery.boredomRecovered ? `一夜过去，饮食厌倦自然缓解 ${fatigueRecovery.boredomRecovered} 点。` : ''}供电策略：${policy.name}。舒适回路与天气结算后电力 ${powerBefore} → ${next.shelter.power}；整夜预算为策略 ${plannedPower.policySpend}${plannedPower.weatherSpend ? `、暴雨 ${plannedPower.weatherSpend}` : ''}${plannedPower.trapSpend ? `、陷阱 ${plannedPower.trapSpend}` : ''}${plannedPower.alarmSpend ? `、警戒 ${plannedPower.alarmSpend}` : ''}，全部负载结束预计剩余 ${plannedPower.remaining}。${powerText}${fridgeText}`,
    next.stats.health < 35 ? 'bad' : 'system',
  )];

  next = resolveHardSiegeWave(next);

  const nightOutcome = determineOutcome(next);
  if (nightOutcome) return { state: finishRun(next, nightOutcome), ok: true };

  next = assessDebtNight(next);
  const debtOutcome = determineOutcome(next);
  if (debtOutcome) return { state: finishRun(next, debtOutcome), ok: true };

  const daysSinceContact = next.lastContactDay === undefined ? Infinity : Math.max(0, absoluteDay(next) - next.lastContactDay);
  if (daysSinceContact >= 2 && next.stats.morale <= 20) {
    next.isolationNights += 1;
    next = applyEffect(next, { stats: { health: next.isolationNights >= 2 ? -4 : 0, stamina: -3 } }, '持续孤立');
    next.logs.push(createLog(next, `无人回应 · 第 ${next.isolationNights} 夜`, next.isolationNights >= 2
      ? '你已经连续多夜没有听见任何真实的人声。睡眠被楼道里的幻听切碎；如果再不建立联络或恢复精神，求生意志会彻底崩溃。'
      : `${inventoryCount(next.inventory, 'radio') > 0 ? '收音机只有底噪' : '屋里没有能接收外界的收音机'}，手机通讯录里的名字都无法接通。这还不是终点，但孤立已经开始消耗身体。`, 'bad'));
  } else if (next.isolationNights > 0) {
    next.logs.push(createLog(next, '孤立中断', daysSinceContact < 2 ? '固定频段或门外终于有人回应。仅仅确认另一个人还活着，就让漫长的夜恢复了边界。' : '你把精神状态拉回危险线以上，重新开始记录日期和行动。', 'good'));
    next.isolationNights = 0;
  }

  const isolationOutcome = determineOutcome(next);
  if (isolationOutcome) return { state: finishRun(next, isolationOutcome), ok: true };

  const finalNight = next.survivalDay >= config.survivalGoalDays;
  if (finalNight) {
    addFlag(next, 'survived-goal-night');
    addFlag(next, 'evacuation-choice-pending');
  }
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
