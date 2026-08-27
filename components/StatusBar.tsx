'use client';

import { DIFFICULTY_MAP } from '../game/data/difficulties.ts';
import type { GameState, StatKey } from '../game/types.ts';
import { dayLabel } from '../game/engine/state.ts';
import { dayEndMinutes, formatClock } from '../game/engine/time.ts';
import { POWER_POLICY_MAP } from '../game/data/power.ts';

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

function BoredomCell({ value }: { value: number }) {
  const level = value >= 70 ? 'danger' : value >= 40 ? 'warning' : 'normal';
  return (
    <div className={`stat-cell inverse ${level}`} aria-label={`饮食厌倦 ${value}/100；数值越低越好`} title="重复吃同一种食物会提高厌倦并削减精神；更换食物或食用不同料理可降低厌倦。">
      <div className="stat-heading"><span>厌倦</span><b>{value}</b></div>
      <span className="stat-track" aria-hidden="true"><i style={{ width: `${value}%` }} /></span>
      {level !== 'normal' && <small>{level === 'danger' ? '很厌烦' : '重复'}</small>}
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
        <span>{state.phase === 'prep' ? `距离封锁 ${8 - state.prepDay} 天` : state.phase === 'survival' ? `${state.weather} · 日终 ${formatClock(dayEndMinutes(state))}` : difficulty.tagline} · 现金 ¥{state.money}</span>
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
  const powerPolicy = POWER_POLICY_MAP[state.powerPolicy];
  const alarmCost = state.phase === 'survival' && state.difficulty === 'hard' && state.survivalDay >= 8 ? 1 : 0;
  const expectedPower = powerPolicy.expectedPower + alarmCost;
  return (
    <aside className="status-dock" aria-label="核心状态">
      <header>
        <span>状态监测</span>
        <div><strong className={state.feedback.some((item) => item.label === '金钱') ? 'resource-pulse' : ''} aria-label={`剩余现金 ${state.money} 元`}>现金 ¥{state.money}</strong><b className={state.feedback.some((item) => item.label === '时间') ? 'resource-pulse' : ''}>{formatClock(state.clockMinutes)}</b></div>
      </header>
      {state.debt && <div className="dock-debt" aria-label={`未结债务 ${state.debt.balance} 元`}>债务 ¥{state.debt.balance} · 第 {state.debt.dueSurvivalDay} 天到期</div>}
      {state.isolationNights > 0 && <div className="dock-isolation" aria-label={`已连续孤立 ${state.isolationNights} 夜`}>联络危机 · 已连续孤立 {state.isolationNights}/3 夜</div>}
      <div className="status-grid">
        {STATS.map(({ key, label }) => <StatCell key={key} label={label} value={state.stats[key]} />)}
        <StatCell label="完整度" value={state.shelter.integrity} />
        <BoredomCell value={state.foodBoredom} />
        <div className="stat-cell resource-cell" aria-label={`电力 ${state.shelter.power}，${powerPolicy.name}，燃料 ${state.shelter.fuel}，愿望点 ${state.dailyPoints}，夜间配给${state.autoRations ? '自动' : '手动'}`}>
          <div className="stat-heading"><span>供能</span><b>{state.shelter.power}</b></div>
          <span className="resource-detail">电 {state.shelter.power} · {powerPolicy.name}（夜耗约 {expectedPower}{alarmCost ? '，含警戒' : ''}）· 燃 {state.shelter.fuel} · 愿望点 {state.dailyPoints} · 配给 {state.autoRations ? '自动' : '手动'}</span>
        </div>
      </div>
    </aside>
  );
}
