'use client';

import { DIFFICULTY_MAP } from '../game/data/difficulties.ts';
import type { GameState, StatKey } from '../game/types.ts';
import { dayLabel } from '../game/engine/state.ts';
import { dayEndMinutes, formatClock } from '../game/engine/time.ts';
import { POWER_POLICY_MAP } from '../game/data/power.ts';
import { survivalPressure } from '../game/data/pressure.ts';
import { powerTrapDefinition } from '../game/data/power-traps.ts';
import { nightPowerBudget } from '../game/engine/siege.ts';

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
    <div className={`stat-cell inverse ${level}`} aria-label={`饮食厌倦 ${value}/100；数值越低越好`} title="单品熟悉度会跨餐保留，交替少数食物不能重置；真正扩大菜单或尝试新料理只能有限缓解。">
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
  const budget = nightPowerBudget(state);
  const expectedPower = state.phase === 'survival' ? budget.totalSpend : powerPolicy.expectedPower;
  const moraleDrain = survivalPressure(state.difficulty, Math.max(1, state.survivalDay)).moraleDrain;
  const trap = powerTrapDefinition(state.powerTrap.level);
  const priorityLoads = [
    budget.weatherSpend ? `暴雨 ${budget.weatherSpend}` : '',
    budget.trapSpend ? `陷阱 ${budget.trapSpend}` : '',
    budget.alarmSpend ? `警戒 ${budget.alarmSpend}` : '',
  ].filter(Boolean).join('、');
  return (
    <aside className="status-dock" aria-label="核心状态">
      <header>
        <span>状态监测</span>
        <div><strong className={state.feedback.some((item) => item.label === '金钱') ? 'resource-pulse' : ''} aria-label={`剩余现金 ${state.money} 元`}>现金 ¥{state.money}</strong><b className={state.feedback.some((item) => item.label === '时间') ? 'resource-pulse' : ''}>{formatClock(state.clockMinutes)}</b></div>
      </header>
      {state.debt && <div className="dock-debt" aria-label={`未结债务 ${state.debt.balance} 元`}>债务 ¥{state.debt.balance} · 第 {state.debt.dueSurvivalDay} 天到期</div>}
      {state.isolationNights > 0 && <div className="dock-isolation" aria-label={`已连续孤立 ${state.isolationNights} 夜`}>联络危机 · 已连续孤立 {state.isolationNights}/3 夜</div>}
      {state.phase === 'survival' && <div className="dock-morale" aria-label={`今晚自然精神消耗 ${moraleDrain} 点`}>今夜心理压力 · 精神 −{moraleDrain}　可通过娱乐、热食、休息或联络恢复</div>}
      <div className="status-grid">
        {STATS.map(({ key, label }) => <StatCell key={key} label={label} value={state.stats[key]} />)}
        <StatCell label="完整度" value={state.shelter.integrity} />
        <BoredomCell value={state.foodBoredom} />
        <div className="stat-cell resource-cell" aria-label={`电力 ${state.shelter.power}，${powerPolicy.name}，夜间预计消耗 ${expectedPower}`}>
          <div className="stat-heading"><span>供能</span><b>{state.shelter.power}</b></div>
          <span className="resource-detail">{powerPolicy.name} · 今夜预计 {expectedPower}{priorityLoads ? `（${priorityLoads}）` : ''}{trap && !budget.trapSpend ? ` · 陷阱${state.powerTrap.armed ? '电力不足/无波次' : '断开'}` : ''}</span>
        </div>
        <div className="stat-cell resource-cell" aria-label={`净水 ${state.shelter.water}，待净化原水 ${state.shelter.rawWater}，燃料 ${state.shelter.fuel}，愿望点 ${state.dailyPoints}`}>
          <div className="stat-heading"><span>储备</span><b>{state.shelter.water}</b></div>
          <span className="resource-detail">净水 {state.shelter.water} · 原水 {state.shelter.rawWater} · 燃 {state.shelter.fuel} · 愿望 {state.dailyPoints} · {state.autoRations ? '自动配给' : '手动配给'}</span>
        </div>
      </div>
    </aside>
  );
}
