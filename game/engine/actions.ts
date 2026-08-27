import { EVENT_MAP } from '../data/events.ts';
import { DIFFICULTY_MAP } from '../data/difficulties.ts';
import { ITEM_MAP, ITEMS } from '../data/items.ts';
import { LOCATION_MAP } from '../data/world.ts';
import type { EventEffect, GameState, ItemDefinition, StoreId } from '../types.ts';
import { addItem, canAddWeight, inventoryCount, inventoryWeight, removeItem } from './inventory.ts';
import { determineOutcome, finishRun, truthEndingReady } from './outcomes.ts';
import { seededPick } from './rng.ts';
import { completeTimedAction, endDay, type EngineResult } from './day.ts';
import { dailyActionBlockedReason, recordDailyAction } from './daily.ts';
import { timeDisabledReason } from './time.ts';
import {
  absoluteDay,
  addFlag,
  applyEffect,
  clamp,
  createLog,
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
      dangerText = ` 危险判定 ${danger.roll}/${danger.risk}：擦伤撤回。`;
    } else if (danger.severity === 'major') {
      next = applyEffect(next, { stats: { stamina: -12, health: -12 }, injury: '外伤' }, '危险判定');
      dangerText = ` 危险判定 ${danger.roll}/${danger.risk}：遭遇严重失误。`;
    } else {
      dangerText = ` 危险判定 ${danger.roll}/${danger.risk}：安全。`;
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
  const started = beginTimedAction(state, 90, 30);
  if (!started.state) return { state, ok: false, message: started.reason ?? '当前无法前往商店。' };
  const next = started.state;
  addFlag(next, `visited-store:${store}`);
  next.logs = [...next.logs, createLog(next, '出门采购', '街上的人比昨天更多，货架上的选择比昨天更少。你在关门前赶到柜台。', 'system')];
  return completeTimedAction(next, 90, 'prep:visit-store');
}

export function purchaseItem(state: GameState, itemId: string, quantity = 1): Result {
  const dailyReason = dailyActionBlockedReason(state);
  if (dailyReason) return { state, ok: false, message: dailyReason };
  const item = ITEM_MAP[itemId];
  if (!item?.store || state.phase !== 'prep') return { state, ok: false, message: '这件物品现在无法购买。' };
  const total = item.price * quantity;
  if (state.money < total) return { state, ok: false, message: `还差 ¥${total - state.money}` };
  if (!canAddWeight(state.inventory, item, quantity, state.carryCapacity, ITEM_MAP)) return { state, ok: false, message: '储物空间不够。' };
  let next = structuredClone(state);
  next.money -= total;
  next.inventory = addItem(next.inventory, item, quantity, absoluteDay(next));
  next.feedback = [
    { id: `${next.runId}-buy-money-${next.logs.length}`, label: '金钱', delta: -total, reason: `购买${item.name}` },
    { id: `${next.runId}-buy-item-${next.logs.length}`, label: item.name, delta: quantity, reason: '采购入库' },
  ];
  next.logs = [...next.logs, createLog(next, `购入 ${item.name}`, `支付 ¥${total}，物品已放入避难所储物区。`, 'good')];
  next = recordDailyAction(next, 'prep:purchase');
  return { state: next, ok: true };
}

export type PrepActionId = 'work' | 'reinforce' | 'water' | 'power' | 'investigate' | 'contact' | 'rest';

export function performPrepAction(state: GameState, action: PrepActionId, npcId?: string): Result {
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
    contact: { relationships: npcId ? { [npcId]: 15 } : { 'chen-meng': 10 }, stats: { morale: 3 } },
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
    contact: '电话另一端沉默了一会儿，最终说：“真出事的话，我们互相敲门。”',
    rest: '你强迫自己离开清单。提前睡下也是准备的一部分。',
  };
  next = applyEffect(next, effects[action], titles[action]);
  if (action === 'work') addFlag(next, `worked:${state.prepDay}`);
  if (action === 'investigate' && next.intel >= 3) addFlag(next, 'routes-revealed');
  next.logs = [...next.logs, createLog(next, titles[action], bodies[action], action === 'rest' ? 'good' : 'story')];
  return completeTimedAction(next, spec.minutes, `prep:${action}`);
}

export type SurvivalActionId = 'rest' | 'repair' | 'barricade' | 'radio' | 'generator' | 'cook' | 'purify' | 'trade-water' | 'trade-med' | 'truth';

export function performSurvivalAction(state: GameState, action: SurvivalActionId): Result {
  if (state.phase !== 'survival') return { state, ok: false, message: '当前不在灾后行动阶段。' };
  const durations: Record<SurvivalActionId, number> = {
    rest: 120,
    repair: 120,
    barricade: 120,
    radio: state.shelter.power >= 2 || inventoryCount(state.inventory, 'batteries') > 0 ? 60 : 120,
    generator: 30,
    cook: 90,
    purify: 90,
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
    if (next.shelter.power >= 2) next = applyEffect(next, { shelter: { power: -2 }, intel: 1, stats: { morale: 3 } }, '收听广播');
    else if (inventoryCount(next.inventory, 'batteries') > 0) next = applyEffect(next, { inventory: { batteries: -1 }, intel: 1, stats: { morale: 3 } }, '收听广播');
    else next = applyEffect(next, { stats: { stamina: -12, morale: 1 }, intel: 1 }, '手摇收听');
    next.broadcasts += 1;
    if (next.broadcasts >= 3) addFlag(next, 'decoded-broadcast');
    title = '收听广播'; body = `你在噪声里记下第 ${next.broadcasts} 段有效讯息。${duration > 60 ? '无电时的手摇发电多花了一小时。' : '重复出现的道路名开始组成一条路线。'}`;
  } else if (action === 'generator') {
    if (next.shelter.generator < 1) return { state, ok: false, message: '灾前没有完成备用供电改造。' };
    if (next.shelter.fuel < 3) return { state, ok: false, message: '燃料不足 3。' };
    title = '启动备用电源'; body = '发电机在阳台上低声运转，你只开了足够充电的一小段时间。';
    next = applyEffect(next, { shelter: { fuel: -3, power: 9 }, stats: { morale: 3 } }, title);
  } else if (action === 'cook') {
    const needs = [['rice', 1], ['water-bottle', 1]] as const;
    const missing = needs.find(([id, count]) => inventoryCount(next.inventory, id) < count);
    if (!next.furniture['gas-stove'].enabled) return { state, ok: false, message: '燃气炉当前不可用。' };
    if (missing || next.shelter.fuel < 2) return { state, ok: false, message: missing ? `缺少 ${ITEM_MAP[missing[0]].name}` : '燃料不足 2。' };
    title = '燃气炉煮饭'; body = '米在小锅里慢慢涨开。你把火关到最小，没有浪费一滴水。';
    next = applyEffect(next, { inventory: { rice: -1, 'water-bottle': -1 }, shelter: { fuel: -2 }, stats: { satiety: 48, hydration: 8, morale: 9, stamina: 4 } }, title);
    next.furniture['gas-stove'].lastUsedDay = absoluteDay(next);
  } else if (action === 'purify') {
    if (inventoryCount(next.inventory, 'purifier-tablet') < 1 || inventoryCount(next.inventory, 'filter-cloth') < 1 || next.shelter.water < 6) {
      return { state, ok: false, message: '需要净水片、滤布与 6 单位储水。' };
    }
    title = '处理雨水'; body = '水先经过滤布，再静置消毒。你分装成两只干净水瓶。';
    next = applyEffect(next, { inventory: { 'purifier-tablet': -1, 'filter-cloth': -1, 'water-bottle': 2 }, shelter: { water: -6 } }, title);
  } else if (action === 'trade-water') {
    if (inventoryCount(next.inventory, 'chocolate') < 1) return { state, ok: false, message: '缺少可交换的巧克力。' };
    title = '与幸存者交易'; body = '十二楼的人用两瓶水换走巧克力。他们说那是留给孩子生日的。';
    next = applyEffect(next, { inventory: { chocolate: -1, 'water-bottle': 2 }, relationships: { 'chen-meng': 3 } }, title);
  } else if (action === 'trade-med') {
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
      body = `中继器过载，发送在 63% 处中断（${danger.roll}/${danger.risk}）。你仍能退回避难所，普通撤离没有被关闭。`;
    } else {
      addFlag(next, 'truth-transmitted');
      body = `校验完成。三个城外接收站先后回应（${danger.roll}/${danger.risk}）。这份数据已经不只存在于城里。`;
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
  let lootCount = (danger.severity === 'safe' ? 3 : danger.severity === 'minor' ? 2 : 1) + lootBonus;
  if (visitCount >= 2) lootCount = 1 + lootBonus;
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
  const riskLabel = danger.risk < 30 ? '低' : danger.risk < 55 ? '中' : '高';
  next.feedback = found.map((name, index) => ({ id: `${next.runId}-loot-${next.logs.length}-${index}`, label: name, delta: 1, reason: location.name }));
  next.logs = [...next.logs, createLog(
    next,
    `探索 · ${location.name}`,
    `${location.description} 判定 ${danger.roll}/${danger.risk}（${riskLabel}风险），${danger.severity === 'safe' ? '安全返回' : danger.severity === 'minor' ? '途中擦伤' : '遭遇危险并受伤'}。带回：${found.length ? found.join('、') : '没有能带走的物资'}。`,
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
    `${accessText} 判定 ${danger.roll}/${danger.risk}，${outcomeText}。冷藏柜的独立电源仍在工作，你带回了${found.join('、')}，并为避难所补充了 10 点备用电力。样本批次 C-17 可作为真相路线证据。`,
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
