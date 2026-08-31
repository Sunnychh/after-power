import { DIFFICULTY_MAP } from '../data/difficulties.ts';
import type { GameState, ItemDefinition, StoreId } from '../types.ts';
import { normalizeSeed, randomInt } from './rng.ts';

const DAILY_STOCK_FACTORS = [1, 0.75, 0.58, 0.42, 0.28, 0.16, 0.08] as const;

export const STORE_OUTBOUND_MINUTES = 45;
export const STORE_RETURN_MINUTES = 45;

export function shoppingOutboundStamina(state: Pick<GameState, 'difficulty'>): number {
  return state.difficulty === 'easy' ? 2 : state.difficulty === 'hard' ? 4 : 3;
}

export function shoppingReturnStamina(state: Pick<GameState, 'difficulty' | 'shoppingTrip'>): number {
  const carriedWeight = Math.max(0, state.shoppingTrip?.carriedWeight ?? 0);
  return shoppingOutboundStamina(state) + Math.ceil(carriedWeight / 3);
}

export function shoppingRoundTripStaminaRange(state: Pick<GameState, 'difficulty'>): { minimum: number; maximum: number } {
  const outbound = shoppingOutboundStamina(state);
  const capacity = DIFFICULTY_MAP[state.difficulty].shoppingCarryCapacity;
  return { minimum: outbound * 2, maximum: outbound * 2 + Math.ceil(capacity / 3) };
}

function baseStockRange(item: ItemDefinition): [number, number] {
  if (item.category === '食物' || item.category === '饮水') return [5, 10];
  if (item.category === '药品') return [3, 6];
  if (item.category === '能源') return [3, 5];
  if (item.category === '材料') return [2, 5];
  return [2, 4];
}

export function storePurchaseKey(prepDay: number, store: StoreId, itemId: string): string {
  return `${prepDay}:${store}:${itemId}`;
}

export function initialStoreStock(state: GameState, item: ItemDefinition): number {
  if (!item.store || state.phase !== 'prep') return 0;
  const [minimum, maximum] = baseStockRange(item);
  const rolled = randomInt(normalizeSeed(`${state.seed}:${item.store}:${item.id}:opening-stock`), minimum, maximum).value;
  const factor = DAILY_STOCK_FACTORS[Math.max(0, Math.min(6, state.prepDay - 1))];
  return Math.floor(rolled * factor);
}

export function storeStock(state: GameState, item: ItemDefinition): { initial: number; purchased: number; remaining: number; label: string } {
  const initial = initialStoreStock(state, item);
  const purchased = item.store ? state.storePurchases[storePurchaseKey(state.prepDay, item.store, item.id)] ?? 0 : 0;
  const remaining = Math.max(0, initial - purchased);
  const label = remaining === 0 ? '已缺货' : remaining === 1 ? '最后 1 件' : state.prepDay >= 5 ? `限购库存 ${remaining}` : `店内剩余 ${remaining}`;
  return { initial, purchased, remaining, label };
}

export function shoppingCarryRemaining(state: GameState): number {
  const trip = state.shoppingTrip;
  if (!trip || trip.prepDay !== state.prepDay) return 0;
  return Math.max(0, trip.capacity - trip.carriedWeight);
}

export function shoppingCarryCapacity(state: GameState): number {
  return DIFFICULTY_MAP[state.difficulty].shoppingCarryCapacity;
}

export function prepSupplyMessage(day: number): string {
  if (day === 1) return '供应尚未中断：货架最完整，适合优先购买重物和关键组合物资。';
  if (day === 2) return '恐慌开始扩散：饮水和常用药首先减少，部分商品已经出现限量。';
  if (day <= 4) return '补货车辆陆续停运：每天的库存都比前一天更少，售罄后不会自动恢复。';
  if (day <= 6) return '大部分货架已经见底：剩余商品严格限购，晚来的人只能换店。';
  return '封锁前最后一天：正常零售已经停止，强行前往可能受伤，也可能在混乱中带回无人看管的物资。';
}
