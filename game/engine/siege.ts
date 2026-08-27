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
    + (state.flags.includes('horde-survived') ? 2 : 0);
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
  const next = applyEffect(state, {
    shelter: { integrity: -damage },
    stats: { morale: damage === 0 ? 3 : damage >= 12 ? -5 : damage >= 7 ? -3 : -1 },
    addFlags: [`siege-wave:${wave.day}`],
  }, `困难波次 · ${wave.name}`);
  const absorbed = Math.min(wave.pressure, mitigation);
  const result = damage === 0
    ? '所有撞击都被加固层吸收，门框没有继续变形。'
    : `避难所完整度 ${integrityBefore} → ${next.shelter.integrity}。${damage >= 12 ? '承重点发出断裂声，必须尽快修缮。' : '加固层仍在，但留下了需要处理的新裂缝。'}`;
  next.logs.push(createLog(next, `第 ${wave.day} 夜 · ${wave.name}`, `冲击 ${wave.pressure} - 加固吸收 ${absorbed} = 实际损伤 ${damage}。${result}`, damage >= 12 ? 'bad' : damage === 0 ? 'good' : 'system'));
  return next;
}
