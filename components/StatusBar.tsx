'use client';

import { DIFFICULTY_MAP } from '../game/data/difficulties.ts';
import type { GameState, StatKey } from '../game/types.ts';
import { dayLabel } from '../game/engine/state.ts';
import { dayEndMinutes, formatClock } from '../game/engine/time.ts';

const STATS: Array<{ key: StatKey; label: string }> = [
  { key: 'health', label: '健康' },
  { key: 'hydration', label: '水分' },
  { key: 'satiety', label: '饱腹' },
  { key: 'morale', label: '精神' },
  { key: 'stamina', label: '体力' },
];

function StatCell({ label, value }: { label: string; value: number }) {
  const level = value <= 20 ? 'danger' : value <= 40 ? 'warning' : 'normal';
  return (
    <div className={`stat-cell ${level}`} aria-label={`${label} ${value}/100`}>
      <div className="stat-heading"><span>{label}</span><b>{value}</b></div>
      <span className="stat-track" aria-hidden="true"><i style={{ width: `${value}%` }} /></span>
      {level !== 'normal' && <small>{level === 'danger' ? '危险' : '偏低'}</small>}
    </div>
  );
}

export function StatusBar({ state, savedAt, onOpenInventory, onOpenSettings, onRestart }: {
  state: GameState;
  savedAt: string;
  onOpenInventory: () => void;
  onOpenSettings: () => void;
  onRestart: () => void;
}) {
  const difficulty = DIFFICULTY_MAP[state.difficulty];
  return (
    <header className="game-header">
      <div className="brand-lockup">
        <button className="drawer-trigger" type="button" onClick={onOpenInventory} aria-label="打开背包">☰</button>
        <span className="mini-mark">断电以后</span>
        <span className="phase-label">{state.phase === 'prep' ? '灾前准备' : state.phase === 'survival' ? '封锁生存' : '本轮结束'} · {difficulty.name}</span>
      </div>
      <div className="day-block">
        <strong>{dayLabel(state)} · {formatClock(state.clockMinutes)}</strong>
        <span>{state.phase === 'prep' ? `距离封锁 ${8 - state.prepDay} 天` : state.phase === 'survival' ? `${state.weather} · 日终 ${formatClock(dayEndMinutes(state))}` : difficulty.tagline}</span>
      </div>
      <div className="header-tools">
        <span className="save-indicator"><i /> 已保存 {savedAt}</span>
        <button type="button" onClick={onRestart}>重新开始</button>
        <button type="button" onClick={onOpenSettings}>设置</button>
      </div>
    </header>
  );
}

export function StatusDock({ state }: { state: GameState }) {
  return (
    <aside className="status-dock" aria-label="核心状态">
      <header><span>状态监测</span><b>{formatClock(state.clockMinutes)}</b></header>
      <div className="status-grid">
        {STATS.map(({ key, label }) => <StatCell key={key} label={label} value={state.stats[key]} />)}
        <StatCell label="完整度" value={state.shelter.integrity} />
        <div className="stat-cell resource-cell" aria-label={`电力 ${state.shelter.power}，燃料 ${state.shelter.fuel}，愿望点 ${state.dailyPoints}`}>
          <div className="stat-heading"><span>供能</span><b>{state.shelter.power}</b></div>
          <span className="resource-detail">电 {state.shelter.power} · 燃 {state.shelter.fuel} · 愿望点 {state.dailyPoints}</span>
        </div>
      </div>
    </aside>
  );
}
