import { EVENT_MAP } from '../data/events.ts';
import { DIFFICULTY_MAP } from '../data/difficulties.ts';
import { ITEM_MAP, ITEMS } from '../data/items.ts';
import { LOCATION_MAP } from '../data/world.ts';
import type { EventEffect, GameState, ItemDefinition, StoreId } from '../types.ts';
import { addItem, canAddWeight, inventoryCount, inventoryWeight, removeItem } from './inventory.ts';
import { determineOutcome, finishRun, truthEndingReady } from './outcomes.ts';
import { randomInt, seededPick } from './rng.ts';
import { shoppingCarryCapacity, shoppingCarryRemaining, storePurchaseKey, storeStock } from './store.ts';
import { completeTimedAction, endDay, type EngineResult } from './day.ts';
import { dailyActionBlockedReason, recordDailyAction } from './daily.ts';
import { isNpcUnlocked, nextBroadcastContact } from './npcs.ts';
import { timeDisabledReason } from './time.ts';
import {
  absoluteDay,
  addFlag,
  applyEffect,
  clamp,
  createLog,
  describeDanger,
  hasFlag,
  rollDanger,
  unmetRequirementLabel,
} from './state.ts';

type Result = EngineResult;

export { endDay };

function finalize(state: GameState): GameState {
  const outcome = determineOutcome(state);
  return outcome ? finishRun(state, outcome) : state;
}

function beginTimedAction(state: GameState, durationMinutes: number, reserveMinutes = 0): { state?: GameState; reason?: string } {
  const dailyReason = dailyActionBlockedReason(state);
  if (dailyReason) return { reason: dailyReason };
  const reason = timeDisabledReason(state, durationMinutes + reserveMinutes);
  if (reason) return { reason };
  return { state: { ...structuredClone(state), feedback: [] } };
}

function effectAffordable(state: GameState, effect?: EventEffect): string | null {
  if (!effect) return null;
  if (effect.money && effect.money < 0 && state.money < -effect.money) return `缺少 ¥${-effect.money}`;
  for (const [itemId, delta] of Object.entries(effect.inventory ?? {})) {
    if (delta < 0 && inventoryCount(state.inventory, itemId) < -delta) return `缺少 ${ITEM_MAP[itemId]?.name ?? itemId} ×${-delta}`;
  }
  for (const [key, delta] of Object.entries(effect.shelter ?? {})) {
    if (['fuel', 'water', 'power'].includes(key) && (delta ?? 0) < 0 && state.shelter[key as keyof GameState['shelter']] < -(delta ?? 0)) {
      const labels: Record<string, string> = { water: '储水', power: '电力', fuel: '燃料', integrity: '完整度' };
      return `${labels[key] ?? key}不足`;
    }
  }
  return null;
}

export function eventOptionDisabledReason(state: GameState, optionIndex: number): string | null {
  const event = state.currentEventId ? EVENT_MAP[state.currentEventId] : undefined;
  const option = event?.options[optionIndex];
  if (!option) return '选项不存在';
  const requirement = unmetRequirementLabel(state, option.requirements);
  return requirement ?? effectAffordable(state, option.effects);
}

export function resolveCurrentEvent(state: GameState, optionIndex: number): Result {
  const dailyReason = dailyActionBlockedReason(state);
  if (dailyReason) return { state, ok: false, message: dailyReason };
  const event = state.currentEventId ? EVENT_MAP[state.currentEventId] : undefined;
  const option = event?.options[optionIndex];
  if (!event || !option) return { state, ok: false, message: '当前没有可处理的事件。' };
  const disabled = eventOptionDisabledReason(state, optionIndex);
  if (disabled) return { state, ok: false, message: disabled };

  let next = structuredClone(state);
  let dangerText = '';
  if (option.danger) {
    const danger = rollDanger(next, option.danger);
    next = danger.state;
    if (danger.severity === 'minor') {
      next = applyEffect(next, { stats: { stamina: -8, health: -3 } }, '危险判定');
      dangerText = ` ${describeDanger(danger)} 结果：擦伤撤回。`;
    } else if (danger.severity === 'major') {
      next = applyEffect(next, { stats: { stamina: -12, health: -12 }, injury: '外伤' }, '危险判定');
      dangerText = ` ${describeDanger(danger)} 结果：遭遇严重失误。`;
    } else {
      dangerText = ` ${describeDanger(danger)}`;
    }
  }
  next = applyEffect(next, option.effects, event.title);
  next.seenEvents = [...next.seenEvents, event.id];
  next.currentEventId = undefined;
  next.logs = [...next.logs, createLog(next, event.title, `${option.result}${dangerText}`, dangerText.includes('严重') ? 'bad' : 'story')];
  return completeTimedAction(next, 30, `event:${event.id}`);
}

export function visitStore(state: GameState, store: StoreId): Result {
  if (state.phase !== 'prep') return { state, ok: false, message: '封锁后商店已经停止营业。' };
  if (state.prepDay === 7) return performLastDayShopping(state, store);
  const started = beginTimedAction(state, 90, 30);
  if (!started.state) return { state, ok: false, message: started.reason ?? '当前无法前往商店。' };
  const next = started.state;
  addFlag(next, `visited-store:${store}`);
  next.shoppingTrip = { store, prepDay: next.prepDay, carriedWeight: 0, capacity: shoppingCarryCapacity(next) };
  next.logs = [...next.logs, createLog(next, '出门采购', `${state.prepDay === 1 ? '街面还算平静，但抢购的苗头已经出现。' : '街上的人比昨天更多，货架上的选择也比昨天更少。'}你只带了一只能装 ${next.shoppingTrip.capacity}kg 的随身包，装满就必须回家。`, 'system')];
  return completeTimedAction(next, 90, 'prep:visit-store');
}

function performLastDayShopping(state: GameState, store: StoreId): Result {
  const started = beginTimedAction(state, 150);
  if (!started.state) return { state, ok: false, message: started.reason ?? '已经来不及冒险采购。' };
  let next = started.state;
  const injuryChance = next.difficulty === 'easy' ? 10 : next.difficulty === 'hard' ? 26 : 18;
  const outcomeRoll = randomInt(next.rngState, 1, 100);
  next.rngState = outcomeRoll.state;
  const storeItems = availableStoreItems(store).sort((a, b) => a.id.localeCompare(b.id));

  if (outcomeRoll.value <= injuryChance) {
    next = applyEffect(next, { stats: { health: next.difficulty === 'hard' ? -14 : -9, stamina: -18, morale: -5 }, injury: outcomeRoll.value <= Math.ceil(injuryChance / 3) ? '外伤' : undefined }, '最后一天强行采购');
    next.logs = [...next.logs, createLog(next, '高风险采购 · 空手返回', `店门口已经挤成一团。随机值 ${outcomeRoll.value} ≤ 受伤线 ${injuryChance}（受伤概率 ${injuryChance}%），你在卷帘门落下前被推倒，只能护着空包回到避难所。`, 'bad')];
    return completeTimedAction(next, 150, 'prep:risky-shopping');
  }

  const capacity = shoppingCarryCapacity(next);
  let carriedWeight = 0;
  const found: string[] = [];
  const attempts = next.difficulty === 'easy' ? 4 : 3;
  for (let index = 0; index < attempts; index += 1) {
    const pick = seededPick(next.rngState, storeItems);
    next.rngState = pick.state;
    const item = pick.value;
    if (carriedWeight + item.weight <= capacity && canAddWeight(next.inventory, item, 1, next.carryCapacity, ITEM_MAP)) {
      next.inventory = addItem(next.inventory, item, 1, absoluteDay(next));
      carriedWeight += item.weight;
      found.push(item.name);
    }
  }
  next.stats.stamina = clamp(next.stats.stamina - 14);
  next.feedback = found.map((name, index) => ({ id: `${next.runId}-last-shop-${next.logs.length}-${index}`, label: name, delta: 1, reason: '无人看管的货架' }));
  next.logs = [...next.logs, createLog(next, '高风险采购 · 无人收银', `收银台已经空了，警报和争吵声盖过一切。你没有付款，在 ${capacity}kg 随身负重内带回：${found.length ? found.join('、') : '没有能装下的物资'}。随机值 ${outcomeRoll.value} > 受伤线 ${injuryChance}（受伤概率 ${injuryChance}%），成功脱身。`, found.length ? 'good' : 'story')];
  return completeTimedAction(next, 150, 'prep:risky-shopping');
}

export function purchaseDisabledReason(state: GameState, itemId: string, quantity = 1): string | null {
  const item = ITEM_MAP[itemId];
  if (!item?.store || state.phase !== 'prep') return '这件物品现在无法购买';
  if (state.prepDay === 7) return '最后一天已经停止正常零售';
  if (!state.shoppingTrip || state.shoppingTrip.store !== item.store || state.shoppingTrip.prepDay !== state.prepDay) return '需要先到达对应商店';
  const stock = storeStock(state, item);
  if (stock.remaining < quantity) return stock.remaining === 0 ? '今日已缺货' : `今日只剩 ${stock.remaining} 件`;
  const total = item.price * quantity;
  if (state.money < total) return `还差 ¥${total - state.money}`;
  if (item.weight * quantity > shoppingCarryRemaining(state) + 0.0001) return `随身包剩余 ${shoppingCarryRemaining(state).toFixed(1)}kg`;
  if (!canAddWeight(state.inventory, item, quantity, state.carryCapacity, ITEM_MAP)) return '避难所储物空间不够';
  return null;
}

export function purchaseItem(state: GameState, itemId: string, quantity = 1): Result {
  const dailyReason = dailyActionBlockedReason(state);
  if (dailyReason) return { state, ok: false, message: dailyReason };
  const item = ITEM_MAP[itemId];
  const disabled = purchaseDisabledReason(state, itemId, quantity);
  if (disabled) return { state, ok: false, message: disabled };
  if (!item?.store || !state.shoppingTrip) return { state, ok: false, message: '这件物品现在无法购买。' };
  const total = item.price * quantity;
  let next = structuredClone(state);
  next.money -= total;
  next.inventory = addItem(next.inventory, item, quantity, absoluteDay(next));
  next.shoppingTrip!.carriedWeight += item.weight * quantity;
  const purchaseKey = storePurchaseKey(next.prepDay, item.store, item.id);
  next.storePurchases[purchaseKey] = (next.storePurchases[purchaseKey] ?? 0) + quantity;
  next.feedback = [
    { id: `${next.runId}-buy-money-${next.logs.length}`, label: '金钱', delta: -total, reason: `购买${item.name}` },
    { id: `${next.runId}-buy-item-${next.logs.length}`, label: item.name, delta: quantity, reason: '采购入库' },
  ];
  next.logs = [...next.logs, createLog(next, `购入 ${item.name}`, `支付 ¥${total}，物品已放入避难所储物区。`, 'good')];
  next = recordDailyAction(next, 'prep:purchase');
  return { state: next, ok: true };
}

export type PrepActionId = 'work' | 'reinforce' | 'water' | 'power' | 'investigate' | 'contact' | 'rest';

export function performPrepAction(state: GameState, action: PrepActionId): Result {
  if (state.phase !== 'prep') return { state, ok: false, message: '灾前行动已经结束。' };
  const specs: Record<PrepActionId, { minutes: number; money?: number }> = {
    work: { minutes: 240 }, reinforce: { minutes: 180, money: 70 }, water: { minutes: 180, money: 90 }, power: { minutes: 180, money: 110 },
    investigate: { minutes: 120 }, contact: { minutes: 90 }, rest: { minutes: 120 },
  };
  const spec = specs[action];
  const started = beginTimedAction(state, spec.minutes);
  if (!started.state) return { state, ok: false, message: started.reason };
  if (action === 'work' && hasFlag(state, `worked:${state.prepDay}`)) return { state, ok: false, message: '今天的临时工作已经结算过了。' };
  if (spec.money && state.money < spec.money) return { state, ok: false, message: `还差 ¥${spec.money - state.money}` };
  let next = started.state;
  const effects: Record<PrepActionId, EventEffect> = {
    work: { money: 170, stats: { stamina: -18, morale: -3 } },
    reinforce: { money: -70, shelter: { integrity: 15, reinforcement: 1 }, stats: { stamina: -8 } },
    water: { money: -90, shelter: { water: 18, storage: 5 }, stats: { stamina: -6 } },
    power: { money: -110, shelter: { power: 8, generator: 1 }, stats: { stamina: -7 } },
    investigate: { intel: 1, stats: { stamina: -6, morale: -1 } },
    contact: { stats: { morale: 3 }, addFlags: ['prep-neighbor-contact'] },
    rest: { stats: { stamina: 25, morale: 5 } },
  };
  const titles: Record<PrepActionId, string> = {
    work: '临时加班', reinforce: '加固门窗', water: '改造储水', power: '接入备用供电', investigate: '核对封锁情报', contact: '联系邻居', rest: '提前休息',
  };
  const bodies: Record<PrepActionId, string> = {
    work: '你把不安藏在表格后面，多接了一份当天结算的工作。',
    reinforce: '木楔、门链和新螺丝把门框变得更可靠。',
    water: '你清洗水箱、换掉软管，并把每个容器都标上日期。',
    power: '备用电路完成切换测试。它不宽裕，但能让收音机和一盏灯工作。',
    investigate: '你把碎片消息按时间排列，找到一个官方通知没解释的空白。',
    contact: '你没有写姓名，只在每户门缝下留了一张纸条：“真停电的话，收音机调到社区频段。”',
    rest: '你强迫自己离开清单。提前睡下也是准备的一部分。',
  };
  next = applyEffect(next, effects[action], titles[action]);
  if (action === 'work') addFlag(next, `worked:${state.prepDay}`);
  if (action === 'investigate' && next.intel >= 3) addFlag(next, 'routes-revealed');
  next.logs = [...next.logs, createLog(next, titles[action], bodies[action], action === 'rest' ? 'good' : 'story')];
  return completeTimedAction(next, spec.minutes, `prep:${action}`);
}

export type SurvivalActionId = 'rest' | 'repair' | 'barricade' | 'radio' | 'generator' | 'purify' | 'drink-storage' | 'trade-water' | 'trade-med' | 'truth';

export function debtPaymentAmount(state: GameState, mode: 'minimum' | 'all'): number {
  if (!state.debt) return 0;
  return mode === 'all' ? state.debt.balance : Math.min(state.debt.balance, state.debt.minimumPayment);
}

export function repayDebtDisabledReason(state: GameState, mode: 'minimum' | 'all'): string | null {
  const dailyReason = dailyActionBlockedReason(state);
  if (dailyReason) return dailyReason;
  if (state.phase !== 'survival' || !state.debt || state.debt.balance <= 0) return '当前没有未结清债务';
  const amount = debtPaymentAmount(state, mode);
  if (state.money < amount) return `现金不足（需要 ¥${amount}）`;
  return timeDisabledReason(state, 30);
}

export function repayDebt(state: GameState, mode: 'minimum' | 'all'): Result {
  const reason = repayDebtDisabledReason(state, mode);
  if (reason) return { state, ok: false, message: reason };
  const started = beginTimedAction(state, 30);
  if (!started.state || !started.state.debt) return { state, ok: false, message: started.reason ?? '当前无法还款。' };
  const amount = debtPaymentAmount(started.state, mode);
  const next = applyEffect(started.state, { money: -amount }, '偿还贷款');
  next.debt!.balance -= amount;
  next.debt!.totalRepaid += amount;
  next.feedback.push({ id: `${next.runId}-debt-${next.logs.length}`, label: '债务', delta: -amount, reason: '偿还贷款' });
  const cleared = next.debt!.balance <= 0;
  next.logs.push(createLog(next, cleared ? '债务结清' : '偿还贷款', cleared ? `你支付 ¥${amount}，删除了催收终端上的最后一笔余额。此后的危险判定不再受到债务影响。` : `你支付 ¥${amount}，剩余债务 ¥${next.debt!.balance}。催收终端确认收款，但倒计时仍在继续。`, cleared ? 'good' : 'system'));
  if (cleared) next.debt = undefined;
  return completeTimedAction(next, 30, 'survival:repay-debt');
}

export function performSurvivalAction(state: GameState, action: SurvivalActionId): Result {
  if (state.phase !== 'survival') return { state, ok: false, message: '当前不在灾后行动阶段。' };
  const durations: Record<SurvivalActionId, number> = {
    rest: 120,
    repair: 120,
    barricade: 120,
    radio: state.shelter.power >= 2 || inventoryCount(state.inventory, 'batteries') > 0 ? 60 : 120,
    generator: 30,
    purify: 90,
    'drink-storage': 20,
    'trade-water': 60,
    'trade-med': 60,
    truth: 180,
  };
  const duration = durations[action];
  const started = beginTimedAction(state, duration);
  if (!started.state) return { state, ok: false, message: started.reason };
  let next = started.state;
  let title = '';
  let body = '';

  if (action === 'rest') {
    title = '休息两小时'; body = '你把背包放回门边，喝了一小口水，闭眼休息到呼吸重新平稳。';
    next = applyEffect(next, { stats: { stamina: 32, morale: 4 } }, title);
  } else if (action === 'repair') {
    title = '修缮避难所';
    if (inventoryCount(next.inventory, 'duct-tape') > 0 && inventoryCount(next.inventory, 'toolkit') > 0) {
      next = applyEffect(next, { inventory: { 'duct-tape': -1 }, shelter: { integrity: 16 }, stats: { stamina: -7 } }, title);
      body = '你用工具重新固定门框，并用胶带封住最宽的缝。';
    } else {
      next = applyEffect(next, { shelter: { integrity: 6 }, stats: { stamina: -15 } }, title);
      body = '没有合适材料，你把废木条做成几块临时支撑。';
    }
  } else if (action === 'barricade') {
    if (inventoryCount(next.inventory, 'wood-board') < 1) return { state, ok: false, message: '缺少木板 ×1' };
    title = '加固门窗'; body = '木板横在门框上，钉子穿过两层旧木料。';
    next = applyEffect(next, { inventory: { 'wood-board': -1 }, shelter: { integrity: 20, reinforcement: 1 }, stats: { stamina: -9 } }, title);
  } else if (action === 'radio') {
    if (inventoryCount(next.inventory, 'radio') < 1) return { state, ok: false, message: '缺少短波收音机。' };
    const newContact = nextBroadcastContact(next);
    const contactEffect = newContact && hasFlag(next, 'prep-neighbor-contact') ? { [newContact.id]: 8 } : undefined;
    if (next.shelter.power >= 2) next = applyEffect(next, { shelter: { power: -2 }, intel: 1, stats: { morale: 3 }, relationships: contactEffect }, '收听广播');
    else if (inventoryCount(next.inventory, 'batteries') > 0) next = applyEffect(next, { inventory: { batteries: -1 }, intel: 1, stats: { morale: 3 }, relationships: contactEffect }, '收听广播');
    else next = applyEffect(next, { stats: { stamina: -12, morale: 1 }, intel: 1, relationships: contactEffect }, '手摇收听');
    next.broadcasts += 1;
    if (newContact) addFlag(next, `npc-unlocked:${newContact.id}`);
    if (next.broadcasts >= 3) addFlag(next, 'decoded-broadcast');
    title = newContact ? `建立联络 · ${newContact.name}` : '收听广播';
    body = `你在噪声里记下第 ${next.broadcasts} 段有效讯息。${newContact ? `${newContact.name}报出身份与固定联络时段，幸存者档案已解锁。${hasFlag(next, 'prep-neighbor-contact') ? '对方认出了你灾前留下的社区频段，初始信任 +8。' : ''}` : '已知呼号重复确认了道路与封锁信息。'}${duration > 60 ? ' 无电时的手摇发电多花了一小时。' : ''}`;
  } else if (action === 'generator') {
    if (next.shelter.generator < 1) return { state, ok: false, message: '灾前没有完成备用供电改造。' };
    if (next.shelter.fuel < 3) return { state, ok: false, message: '燃料不足 3。' };
    title = '启动备用电源'; body = '发电机在阳台上低声运转，你只开了足够充电的一小段时间。';
    next = applyEffect(next, { shelter: { fuel: -3, power: 9 }, stats: { morale: 3 } }, title);
  } else if (action === 'purify') {
    if (inventoryCount(next.inventory, 'purifier-tablet') < 1 || inventoryCount(next.inventory, 'filter-cloth') < 1 || next.shelter.water < 6) {
      return { state, ok: false, message: '需要净水片、滤布与 6 单位储水。' };
    }
    title = '处理雨水'; body = '水先经过滤布，再静置消毒。你分装成两只干净水瓶。';
    next = applyEffect(next, { inventory: { 'purifier-tablet': -1, 'filter-cloth': -1, 'water-bottle': 2 }, shelter: { water: -6 } }, title);
  } else if (action === 'drink-storage') {
    if (next.shelter.water < 4) return { state, ok: false, message: '储水装置至少需要 4 单位可用水。' };
    title = '从储水装置取水'; body = '你打开标有日期的水阀，只接出一杯当天需要的量，然后重新检查密封。';
    next = applyEffect(next, { shelter: { water: -4 }, stats: { hydration: 26, morale: 1 } }, title);
  } else if (action === 'trade-water') {
    if (!isNpcUnlocked(next, 'chen-meng')) return { state, ok: false, message: '尚未通过广播与陈檬建立联络。' };
    if (inventoryCount(next.inventory, 'chocolate') < 1) return { state, ok: false, message: '缺少可交换的巧克力。' };
    title = '与幸存者交易'; body = '十二楼的人用两瓶水换走巧克力。他们说那是留给孩子生日的。';
    next = applyEffect(next, { inventory: { chocolate: -1, 'water-bottle': 2 }, relationships: { 'chen-meng': 3 } }, title);
  } else if (action === 'trade-med') {
    if (!isNpcUnlocked(next, 'lin-zhou')) return { state, ok: false, message: '尚未通过广播与林舟建立联络。' };
    if (inventoryCount(next.inventory, 'batteries') < 1) return { state, ok: false, message: '缺少电池组。' };
    title = '与林舟交换'; body = '林舟收下一组电池，换给你一卷重新密封的绷带。';
    next = applyEffect(next, { inventory: { batteries: -1, bandage: 1 }, relationships: { 'lin-zhou': 3 } }, title);
  } else if (action === 'truth') {
    if (!truthEndingReady(next)) return { state, ok: false, message: '证据、人脉或广播条件尚未满足。' };
    title = '向封锁线外发送证据';
    addFlag(next, 'truth-attempted');
    const danger = rollDanger(next, 46);
    next = danger.state;
    if (danger.severity === 'major') {
      next = applyEffect(next, { stats: { health: -14, stamina: -18 }, shelter: { power: -4 } }, title);
      addFlag(next, 'truth-attempt-failed');
      body = `中继器过载，发送在 63% 处中断。${describeDanger(danger)} 你仍能退回避难所，普通撤离没有被关闭。`;
    } else {
      addFlag(next, 'truth-transmitted');
      body = `校验完成。三个城外接收站先后回应。${describeDanger(danger)} 这份数据已经不只存在于城里。`;
    }
  }

  next.logs = [...next.logs, createLog(next, title, body, action === 'truth' && !hasFlag(next, 'truth-transmitted') ? 'bad' : 'good')];
  return completeTimedAction(next, duration, `survival:${action}`);
}

export function exploreLocation(state: GameState, locationId: string): Result {
  const location = LOCATION_MAP[locationId];
  if (!location || state.phase !== 'survival') return { state, ok: false, message: '无法前往该地点。' };
  const started = beginTimedAction(state, 240);
  if (!started.state) return { state, ok: false, message: started.reason ?? '今天没有足够时间探索。' };
  let next = started.state;
  const weatherPenalty = next.weather === '酸雨' ? 12 : next.weather === '暴雨' ? 9 : next.weather === '大雾' ? 7 : 0;
  const danger = rollDanger(next, location.risk + Math.min(18, (next.survivalDay - 1) * 2) + weatherPenalty);
  next = danger.state;
  const visitCount = next.visited[locationId] ?? 0;
  const lootBonus = DIFFICULTY_MAP[next.difficulty].lootBonus;
  let lootCount = Math.max(0, (danger.severity === 'safe' ? 3 : danger.severity === 'minor' ? 2 : 1) + lootBonus);
  if (visitCount >= 1) lootCount = Math.max(0, 1 + lootBonus);
  const found: string[] = [];
  for (let i = 0; i < lootCount; i += 1) {
    const pick = seededPick(next.rngState, [...location.loot].sort());
    next.rngState = pick.state;
    const item = ITEM_MAP[pick.value];
    if (item && canAddWeight(next.inventory, item, 1, next.carryCapacity, ITEM_MAP)) {
      next.inventory = addItem(next.inventory, item, 1, absoluteDay(next));
      found.push(item.name);
    }
  }
  if (visitCount === 0 && location.uniqueItem) {
    const unique = ITEM_MAP[location.uniqueItem];
    if (unique && canAddWeight(next.inventory, unique, 1, next.carryCapacity, ITEM_MAP)) {
      next.inventory = addItem(next.inventory, unique, 1, absoluteDay(next));
      found.push(unique.name);
      addFlag(next, `found:${unique.id}`);
    }
  }
  next.visited[locationId] = visitCount + 1;
  next.stats.stamina = clamp(next.stats.stamina - (danger.severity === 'safe' ? 13 : 18));
  if (danger.severity === 'minor') next = applyEffect(next, { stats: { health: -4, morale: -2 } }, '探索擦伤');
  if (danger.severity === 'major') next = applyEffect(next, { stats: { health: -13, morale: -5 }, injury: '外伤' }, '探索受伤');
  if (next.weather === '酸雨' && inventoryCount(next.inventory, 'raincoat') < 1) next = applyEffect(next, { stats: { health: -5 } }, '酸雨暴露');
  if (inventoryCount(next.inventory, 'masks') > 0 && location.risk >= 38) next.inventory = removeItem(next.inventory, 'masks', 1) ?? next.inventory;
  next.feedback = found.map((name, index) => ({ id: `${next.runId}-loot-${next.logs.length}-${index}`, label: name, delta: 1, reason: location.name }));
  next.logs = [...next.logs, createLog(
    next,
    `探索 · ${location.name}`,
    `${location.description} ${describeDanger(danger)} 结果：${danger.severity === 'safe' ? '安全返回' : danger.severity === 'minor' ? '途中擦伤' : '遭遇危险并受伤'}。带回：${found.length ? found.join('、') : '没有能带走的物资'}。`,
    danger.severity === 'major' ? 'bad' : 'story',
  )];
  return completeTimedAction(next, 240, 'survival:explore');
}

export function substationControlAccess(state: GameState): { available: boolean; reason?: string; method?: 'key' | 'route'; baseRisk?: number } {
  if (state.phase !== 'survival') return { available: false, reason: '封锁发生后才能前往控制层。' };
  if (hasFlag(state, 'substation-control-searched')) return { available: false, reason: '控制层已经搜查完毕。' };
  if (inventoryCount(state.inventory, 'station-key') > 0) return { available: true, method: 'key', baseRisk: 24 };
  if (hasFlag(state, 'substation-route')) return { available: true, method: 'route', baseRisk: 52 };
  return { available: false, reason: '需要变电站铜钥匙，或备用入口路线。' };
}

export function exploreSubstationControl(state: GameState): Result {
  const access = substationControlAccess(state);
  if (!access.available || !access.method || access.baseRisk === undefined) {
    return { state, ok: false, message: access.reason ?? '无法进入变电站控制层。' };
  }
  const started = beginTimedAction(state, 180);
  if (!started.state) return { state, ok: false, message: started.reason ?? '今天没有足够时间进入控制层。' };

  let next = started.state;
  const weatherPenalty = next.weather === '酸雨' ? 8 : next.weather === '暴雨' ? 6 : next.weather === '大雾' ? 4 : 0;
  const danger = rollDanger(next, access.baseRisk + weatherPenalty);
  next = danger.state;

  const found: string[] = [];
  const sample = ITEM_MAP['sample-tube'];
  next.inventory = addItem(next.inventory, sample, 1, absoluteDay(next));
  found.push(sample.name);
  if (canAddWeight(next.inventory, ITEM_MAP.batteries, 2, next.carryCapacity, ITEM_MAP)) {
    next.inventory = addItem(next.inventory, ITEM_MAP.batteries, 2, absoluteDay(next));
    found.push('电池组 ×2');
  }
  next = applyEffect(next, { shelter: { power: 10 }, intel: 1, stats: { stamina: -12 } }, '变电站控制层');
  const controlFeedback = [...next.feedback];
  addFlag(next, 'substation-control-searched');
  addFlag(next, 'evidence-substation');

  if (danger.severity === 'minor') next = applyEffect(next, { stats: { health: -4, morale: -2 } }, '控制层漏电');
  if (danger.severity === 'major') next = applyEffect(next, { stats: { health: -12, morale: -5 }, injury: '外伤' }, '控制层险情');
  const dangerFeedback = [...next.feedback];

  const accessText = access.method === 'key'
    ? '铜钥匙打开了控制楼内侧的机械锁，你避开了破损的电缆沟。'
    : '你照着手绘路线翻进备用入口，必须穿过一段积水的电缆沟。';
  const outcomeText = danger.severity === 'safe' ? '没有触发残余电弧' : danger.severity === 'minor' ? '手背被电弧灼伤' : '平台护栏断裂，你受伤后才爬回通道';
  next.feedback = [
    ...controlFeedback,
    ...dangerFeedback,
    { id: `${next.runId}-control-sample-${next.logs.length}`, label: sample.name, delta: 1, reason: '控制层冷藏柜' },
    ...(found.includes('电池组 ×2') ? [{ id: `${next.runId}-control-battery-${next.logs.length}`, label: '电池组', delta: 2, reason: '控制层储物柜' }] : []),
  ];
  next.logs = [...next.logs, createLog(
    next,
    '支线 · 变电站控制层',
    `${accessText} ${describeDanger(danger)} 结果：${outcomeText}。冷藏柜的独立电源仍在工作，你带回了${found.join('、')}，并为避难所补充了 10 点备用电力。样本批次 C-17 可作为真相路线证据。`,
    danger.severity === 'major' ? 'bad' : 'story',
  )];
  return completeTimedAction(next, 180, 'survival:explore');
}

export function useItem(state: GameState, itemId: string): Result {
  const dailyReason = dailyActionBlockedReason(state);
  if (dailyReason) return { state, ok: false, message: dailyReason };
  const item = ITEM_MAP[itemId];
  if (!item?.usable || inventoryCount(state.inventory, itemId) < 1) return { state, ok: false, message: '这件物品现在不能使用。' };
  const removed = removeItem(state.inventory, itemId, 1);
  if (!removed) return { state, ok: false, message: '物品数量不足。' };
  let next: GameState = { ...structuredClone(state), inventory: removed, feedback: [] };
  next = applyEffect(next, {
    stats: {
      satiety: item.effects?.satiety,
      hydration: item.effects?.hydration,
      health: item.effects?.health,
      morale: item.effects?.morale,
      stamina: item.effects?.stamina,
    },
    shelter: {
      water: item.effects?.water,
      power: item.effects?.power,
      fuel: item.effects?.fuel,
      integrity: item.effects?.integrity,
    },
  }, `使用${item.name}`);
  if (item.tags?.includes('wound')) next.injuries = next.injuries.filter((injury) => injury !== '外伤');
  if (item.tags?.includes('infection')) next.injuries = next.injuries.filter((injury) => injury !== '感染迹象');
  next.feedback.push({ id: `${next.runId}-use-${next.logs.length}`, label: item.name, delta: -1, reason: '使用' });
  next.logs = [...next.logs, createLog(next, `使用 ${item.name}`, `${item.description} 数值变化已记录。`, 'good')];
  next = recordDailyAction(next, `use:${item.id}`);
  return { state: finalize(next), ok: true };
}

export function inventorySummary(state: GameState): { weight: number; capacity: number; count: number } {
  return {
    weight: inventoryWeight(state.inventory, ITEM_MAP),
    capacity: state.carryCapacity,
    count: Object.keys(state.inventory).reduce((sum, id) => sum + inventoryCount(state.inventory, id), 0),
  };
}

export function availableStoreItems(store: StoreId): ItemDefinition[] {
  return ITEMS.filter((item) => item.store === store);
}
