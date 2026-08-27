import { HARD_SIEGE_WAVES, type SiegeWaveDefinition } from '../data/siege.ts';
import type { GameState } from '../types.ts';
import { applyEffect, createLog } from './state.ts';

export function siegeWaveForDay(state: GameState, day = state.survivalDay): SiegeWaveDefinition | undefined {
  if (state.difficulty !== 'hard' || state.phase !== 'survival') return undefined;
  if (state.flags.includes(`siege-wave:${day}`)) return undefined;
  return HARD_SIEGE_WAVES.find((wave) => wave.day === day);
}

export function nextSiegeWave(state: GameState): SiegeWaveDefinition | undefined {
  if (state.difficulty !== 'hard' || state.phase !== 'survival') return undefined;
  return HARD_SIEGE_WAVES.find((wave) => wave.day >= state.survivalDay && !state.flags.includes(`siege-wave:${wave.day}`));
}

export function siegeMitigation(state: GameState): number {
  return state.shelter.reinforcement * 2
    + (state.flags.includes('horde-prepared') ? 3 : 0)
    + (state.flags.includes('horde-braced') ? 1 : 0)
    + (state.flags.includes('horde-survived') ? 2 : 0)
    + (state.flags.includes('npc-allied:chen-meng') ? 2 : 0);
}

export function siegeDamage(state: GameState, wave: SiegeWaveDefinition): number {
  return Math.max(0, wave.pressure - siegeMitigation(state));
}

export function resolveHardSiegeWave(state: GameState): GameState {
  const wave = siegeWaveForDay(state);
  if (!wave) return state;
  const mitigation = siegeMitigation(state);
  const damage = siegeDamage(state, wave);
  const integrityBefore = state.shelter.integrity;
  const reinforcementBefore = state.shelter.reinforcement;
  const reinforcementWear = Math.min(reinforcementBefore, wave.reinforcementWear);
  const baseFatigue = wave.day >= 13 ? 9 : wave.day >= 11 ? 7 : wave.day >= 8 ? 5 : 2;
  const poweredAlarm = wave.day >= 8 && state.shelter.power >= 1;
  const guardFatigue = Math.max(1, baseFatigue - (poweredAlarm ? 2 : 0));
  const moraleChange = damage === 0 ? -1 : damage >= 12 ? -6 : damage >= 7 ? -4 : -2;
  const next = applyEffect(state, {
    shelter: { integrity: -damage, reinforcement: -reinforcementWear, power: poweredAlarm ? -1 : 0 },
    stats: { morale: moraleChange + (wave.day >= 8 && !poweredAlarm ? -2 : 0), stamina: -guardFatigue },
    addFlags: [`siege-wave:${wave.day}`],
  }, `困难波次 · ${wave.name}`);
  const absorbed = Math.min(wave.pressure, mitigation);
  const wearText = reinforcementWear > 0
    ? ` 承受冲击后，加固 ${reinforcementBefore} → ${next.shelter.reinforcement}；磨损的材料需要重新补上。`
    : '';
  const result = damage === 0
    ? '所有撞击都被加固层吸收，门框没有继续变形。'
    : `避难所完整度 ${integrityBefore} → ${next.shelter.integrity}。${damage >= 12 ? '承重点发出断裂声，必须尽快修缮。' : '加固层仍在，但留下了需要处理的新裂缝。'}`;
  const alarmText = wave.day < 8
    ? `守夜体力 -${guardFatigue}。`
    : poweredAlarm
      ? `楼道门磁消耗电力 1，提前预警把守夜体力消耗降到 -${guardFatigue}。`
      : `警戒线无电，守夜体力 -${guardFatigue}、精神额外 -2。`;
  next.logs.push(createLog(next, `第 ${wave.day} 夜 · ${wave.name}`, `冲击 ${wave.pressure} - 加固吸收 ${absorbed} = 实际损伤 ${damage}。${result}${wearText} ${alarmText}`, damage >= 12 ? 'bad' : 'system'));
  return next;
}
