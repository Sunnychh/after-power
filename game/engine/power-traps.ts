import { powerTrapDefinition } from '../data/power-traps.ts';
import { ITEM_MAP } from '../data/items.ts';
import type { GameState } from '../types.ts';
import { completeTimedAction, type EngineResult } from './day.ts';
import { dailyActionBlockedReason } from './daily.ts';
import { inventoryCount } from './inventory.ts';
import { applyEffect, createLog } from './state.ts';
import { timeDisabledReason } from './time.ts';

export function nextPowerTrap(state: GameState) {
  return powerTrapDefinition(state.powerTrap.level + 1);
}

export function powerTrapUpgradeDisabledReason(state: GameState): string | null {
  if (state.phase !== 'survival') return '封锁后才能把走廊改造成陷阱区';
  if (state.difficulty !== 'hard') return '固定尸潮波次只在艰难难度出现，无需消耗材料建设陷阱';
  const daily = dailyActionBlockedReason(state);
  if (daily) return daily;
  const trap = nextPowerTrap(state);
  if (!trap) return '电力陷阱已经达到最高等级';
  const timed = timeDisabledReason(state, trap.minutes);
  if (timed) return timed;
  if (trap.level >= 2 && inventoryCount(state.inventory, 'toolkit') < 1) return '升级需要家用工具箱';
  for (const [itemId, quantity] of Object.entries(trap.materials)) {
    if (inventoryCount(state.inventory, itemId) < quantity) return `缺少 ${ITEM_MAP[itemId]?.name ?? itemId} ×${quantity}`;
  }
  return null;
}

export function upgradePowerTrap(state: GameState): EngineResult {
  const disabled = powerTrapUpgradeDisabledReason(state);
  if (disabled) return { state, ok: false, message: disabled };
  const trap = nextPowerTrap(state)!;
  let next = structuredClone(state);
  const inventory = Object.fromEntries(Object.entries(trap.materials).map(([itemId, quantity]) => [itemId, -quantity]));
  next = applyEffect(next, { inventory }, `建设 · ${trap.name}`);
  next.powerTrap = { level: trap.level, armed: true };
  next.logs.push(createLog(next, `电力陷阱升级 · ${trap.name}`, `${trap.description}陷阱已默认接入警戒回路：每次困难波次消耗 ${trap.powerCost} 电，先抵消 ${trap.attack} 点尸潮冲击。`, 'good'));
  return completeTimedAction(next, trap.minutes, 'survival:power-trap');
}

export function setPowerTrapArmed(state: GameState, armed: boolean): EngineResult {
  if (state.powerTrap.level <= 0) return { state, ok: false, message: '尚未安装电力陷阱。' };
  if (state.powerTrap.armed === armed) return { state, ok: false, message: armed ? '陷阱已经启用。' : '陷阱已经断开。' };
  const next = structuredClone(state);
  next.feedback = [];
  next.powerTrap.armed = armed;
  next.logs.push(createLog(next, armed ? '接通电力陷阱' : '断开电力陷阱', armed ? '走廊陷阱重新接入警戒回路；只有困难波次到来时才会放电。' : '你断开陷阱回路以保留电力；它不会参与下一次尸潮冲击。', 'system'));
  return { state: next, ok: true };
}
