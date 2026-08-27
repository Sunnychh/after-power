import { CONTACT_MAP, type ContactNpcId, type ContactOptionDefinition } from '../data/contacts.ts';
import { NPC_MAP } from '../data/world.ts';
import type { EventEffect, GameState } from '../types.ts';
import { completeTimedAction, type EngineResult } from './day.ts';
import { dailyActionBlockedReason } from './daily.ts';
import { inventoryCount } from './inventory.ts';
import { isNpcUnlocked } from './npcs.ts';
import { applyEffect, createLog, unmetRequirementLabel } from './state.ts';
import { timeDisabledReason } from './time.ts';

export const CONTACT_MINUTES = 45;

function sumRecord<T extends string>(first: Partial<Record<T, number>> = {}, second: Partial<Record<T, number>> = {}): Partial<Record<T, number>> {
  const result: Partial<Record<T, number>> = { ...first };
  for (const [key, value] of Object.entries(second) as Array<[T, number | undefined]>) result[key] = (result[key] ?? 0) + (value ?? 0);
  return result;
}

function mergeEffects(first: EventEffect, second: EventEffect): EventEffect {
  return {
    stats: sumRecord(first.stats, second.stats),
    shelter: sumRecord(first.shelter, second.shelter),
    inventory: sumRecord(first.inventory, second.inventory) as Record<string, number>,
    relationships: sumRecord(first.relationships, second.relationships) as Record<string, number>,
    money: (first.money ?? 0) + (second.money ?? 0),
    intel: (first.intel ?? 0) + (second.intel ?? 0),
    addFlags: [...(first.addFlags ?? []), ...(second.addFlags ?? [])],
    removeFlags: [...(first.removeFlags ?? []), ...(second.removeFlags ?? [])],
  };
}

export function npcAllianceFlag(npcId: string): string {
  return `npc-allied:${npcId}`;
}

export function contactDayFlag(state: GameState, npcId: string): string {
  return `contact:${state.survivalDay}:${npcId}`;
}

export function contactMethod(state: GameState): { minutes: number; label: string; effect: EventEffect } {
  if (state.shelter.power >= 1) return { minutes: CONTACT_MINUTES, label: '电力 -1', effect: { shelter: { power: -1 } } };
  if (inventoryCount(state.inventory, 'batteries') >= 1) return { minutes: CONTACT_MINUTES, label: '电池 -1', effect: { inventory: { batteries: -1 } } };
  return { minutes: CONTACT_MINUTES + 30, label: '手摇发电，体力 -10', effect: { stats: { stamina: -10 } } };
}

export function contactOptions(npcId: string): ContactOptionDefinition[] {
  return CONTACT_MAP[npcId as ContactNpcId]?.options ?? [];
}

export function activeContactDisabledReason(state: GameState, npcId: string, optionId: string): string | null {
  const dailyReason = dailyActionBlockedReason(state);
  if (dailyReason) return dailyReason;
  if (state.currentEventId) return '先处理眼前的事件';
  if (state.phase !== 'survival') return '封锁前无法使用幸存者频道';
  if (state.expedition) return '先从探索地点返回';
  if (inventoryCount(state.inventory, 'radio') < 1) return '缺少短波收音机';
  const npc = NPC_MAP[npcId];
  const contact = CONTACT_MAP[npcId as ContactNpcId];
  if (!npc || !contact || !isNpcUnlocked(state, npcId)) return '尚未通过广播建立这条联络';
  if (state.flags.includes(contactDayFlag(state, npcId))) return `今天已经主动联络过${npc.name}`;
  const method = contactMethod(state);
  const timeReason = timeDisabledReason(state, method.minutes);
  if (timeReason) return timeReason;
  if (method.label.includes('手摇') && state.stats.stamina <= 10) return '体力不足以维持手摇通话';
  if (optionId === 'alliance') {
    if (state.flags.includes(npcAllianceFlag(npcId))) return '已经结盟';
    if ((state.relationships[npcId] ?? 0) < npc.allianceThreshold) return `信任需要 ${npc.allianceThreshold}（当前 ${state.relationships[npcId] ?? 0}）`;
    return null;
  }
  const option = contact.options.find((entry) => entry.id === optionId);
  if (!option) return '联络选项不存在';
  return unmetRequirementLabel(state, option.requirements);
}

export function performActiveContact(state: GameState, npcId: string, optionId: string): EngineResult {
  const disabled = activeContactDisabledReason(state, npcId, optionId);
  if (disabled) return { state, ok: false, message: disabled };
  const npc = NPC_MAP[npcId];
  const contact = CONTACT_MAP[npcId as ContactNpcId];
  const method = contactMethod(state);
  const option = contact.options.find((entry) => entry.id === optionId);
  const isAlliance = optionId === 'alliance';
  const actionEffect: EventEffect = isAlliance
    ? { stats: { morale: 6 }, addFlags: [npcAllianceFlag(npcId)] }
    : option?.effects ?? {};
  const next = applyEffect(state, mergeEffects(method.effect, {
    ...actionEffect,
    addFlags: [...(actionEffect.addFlags ?? []), contactDayFlag(state, npcId)],
  }), `主动联络 · ${npc.name}`);
  const result = isAlliance ? contact.allianceResult : option!.result;
  next.logs.push(createLog(next, isAlliance ? `结盟 · ${npc.name}` : `主动联络 · ${npc.name}`, `${result} 通讯方式：${method.label}。${isAlliance ? `永久能力“${npc.talentName}”开始生效。` : ''}`, isAlliance ? 'good' : 'story'));
  return completeTimedAction(next, method.minutes, `survival:contact:${npcId}`);
}

export function contactCostText(state: GameState): string {
  const method = contactMethod(state);
  return `${method.minutes}分钟 · ${method.label}`;
}
