'use client';

import { useEffect, useState } from 'react';
import { createInitialState } from '../game/engine/state.ts';
import { awardOutcome } from '../game/engine/outcomes.ts';
import { evaluateAchievements } from '../game/engine/achievements.ts';
import { clearGame, DEFAULT_SETTINGS, loadGame, loadMeta, loadSettings, saveGame, saveMeta, saveSettings } from '../game/engine/save.ts';
import { formatClock, formatDuration } from '../game/engine/time.ts';
import type { AbilityId, DifficultyId, GameState, LoanTier, MetaState, SettingsState } from '../game/types.ts';
import { AchievementGallery } from './AchievementGallery.tsx';
import { GameView } from './GameView.tsx';
import { Modal } from './Modal.tsx';
import { TitleScreen } from './TitleScreen.tsx';

function timeLabel(): string {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
}

function nextSeedLabel(): string {
  const values = new Uint32Array(1);
  window.crypto.getRandomValues(values);
  return `AFTERLIGHT-${values[0].toString(36).toUpperCase().padStart(6, '0').slice(-6)}`;
}

export default function GameApp() {
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<'title' | 'game'>('title');
  const [state, setState] = useState<GameState | null>(null);
  const [saved, setSaved] = useState<GameState | null>(null);
  const [meta, setMeta] = useState<MetaState>({ version: 1, memory: 0, runs: 0, unlocked: [], endings: [], awardedRuns: [], achievements: [] });
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [seed, setSeed] = useState('AFTERLIGHT-001');
  const [difficulty, setDifficulty] = useState<DifficultyId>('easy');
  const [autoRations, setAutoRations] = useState(true);
  const [loanTier, setLoanTier] = useState<LoanTier>('none');
  const [savedAt, setSavedAt] = useState('--:--');
  const [notice, setNotice] = useState<string | null>(null);
  const [achievementNotice, setAchievementNotice] = useState<{ id: number; names: string[] } | null>(null);
  const [changeCue, setChangeCue] = useState<{ id: number; money?: string; time?: string } | null>(null);
  const [modal, setModal] = useState<'guide' | 'achievements' | 'settings' | 'restart' | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const loaded = loadGame(window.localStorage);
      const loadedMeta = loadMeta(window.localStorage);
      const evaluated = evaluateAchievements(loadedMeta, loaded);
      setSaved(loaded);
      setState(loaded);
      setMeta(evaluated.meta);
      if (evaluated.unlocked.length) {
        saveMeta(window.localStorage, evaluated.meta);
        setAchievementNotice({ id: Date.now(), names: evaluated.unlocked.map((achievement) => achievement.name) });
      }
      setSettings(loadSettings(window.localStorage));
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!achievementNotice) return;
    const timer = window.setTimeout(() => setAchievementNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [achievementNotice]);

  useEffect(() => {
    if (!changeCue) return;
    const timer = window.setTimeout(() => setChangeCue(null), 2400);
    return () => window.clearTimeout(timer);
  }, [changeCue]);

  const commit = (next: GameState) => {
    let nextMeta = meta;
    let metaChanged = false;
    if (next.phase === 'ended' && next.outcome && !meta.awardedRuns.includes(next.runId)) {
      nextMeta = awardOutcome(meta, next);
      metaChanged = true;
    }
    const achievementResult = evaluateAchievements(nextMeta, next);
    if (achievementResult.unlocked.length) {
      nextMeta = achievementResult.meta;
      metaChanged = true;
      setAchievementNotice({ id: Date.now(), names: achievementResult.unlocked.map((achievement) => achievement.name) });
    }
    if (metaChanged) {
      setMeta(nextMeta);
      saveMeta(window.localStorage, nextMeta);
    }
    setState(next);
    setSaved(next);
    saveGame(window.localStorage, next);
    setSavedAt(timeLabel());
  };

  const handleResult = (result: { state: GameState; ok: boolean; message?: string }): boolean => {
    if (!result.ok) {
      setNotice(result.message ?? '这个行动现在无法执行。');
      return false;
    }
    if (state) {
      const moneyDelta = result.state.money - state.money;
      const sameDay = result.state.phase === state.phase && result.state.prepDay === state.prepDay && result.state.survivalDay === state.survivalDay;
      const elapsed = sameDay ? result.state.clockMinutes - state.clockMinutes : 0;
      const money = moneyDelta ? `${moneyDelta > 0 ? '+' : '-'}¥${Math.abs(moneyDelta)}` : undefined;
      const time = elapsed > 0 ? `${formatClock(state.clockMinutes)} → ${formatClock(result.state.clockMinutes)} · +${formatDuration(elapsed)}` : !sameDay ? `时间推进至 ${formatClock(result.state.clockMinutes)}` : undefined;
      if (money || time) setChangeCue({ id: Date.now(), money, time });
    }
    commit(result.state);
    return true;
  };

  const startFresh = () => {
    const next = createInitialState(seed.trim() || 'AFTERLIGHT-001', meta.unlocked, meta.runs, difficulty, autoRations, loanTier);
    commit(next);
    setScreen('game');
    setModal(null);
  };

  const startRequested = () => {
    if (saved && saved.phase !== 'ended') setModal('restart');
    else startFresh();
  };

  const updateSettings = (patch: Partial<SettingsState>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(window.localStorage, next);
  };

  const unlock = (ability: AbilityId, cost: number) => {
    if (meta.unlocked.includes(ability) || meta.memory < cost) return;
    const next = { ...meta, memory: meta.memory - cost, unlocked: [...meta.unlocked, ability] };
    setMeta(next);
    saveMeta(window.localStorage, next);
  };

  if (!ready) return <main className="loading-screen"><span>正在恢复本地记录</span><i /></main>;

  return (
    <div className={`app-root font-${settings.fontScale} ${settings.reducedMotion ? 'reduce-motion' : ''} ${settings.highContrast ? 'high-contrast' : ''}`}>
      {screen === 'title' ? (
        <TitleScreen
          hasSave={Boolean(saved)}
          seed={seed}
          difficulty={difficulty}
          autoRations={autoRations}
          loanTier={loanTier}
          meta={meta}
          onSeedChange={setSeed}
          onDifficultyChange={(nextDifficulty) => { setDifficulty(nextDifficulty); setAutoRations(nextDifficulty === 'easy'); }}
          onAutoRationsChange={setAutoRations}
          onLoanTierChange={setLoanTier}
          onStart={startRequested}
          onContinue={() => { if (saved) { setState(saved); setScreen('game'); } }}
          onGuide={() => setModal('guide')}
          onAchievements={() => setModal('achievements')}
          onSettings={() => setModal('settings')}
          onUnlock={unlock}
        />
      ) : state ? (
        <GameView
          state={state}
          settings={settings}
          savedAt={savedAt}
          onResult={handleResult}
          onCommit={commit}
          onSettings={() => setModal('settings')}
          onRestart={() => setModal('restart')}
          onReturnTitle={() => setScreen('title')}
          onNextRound={() => { setSeed(nextSeedLabel()); setScreen('title'); }}
        />
      ) : null}

      {notice && <div className="notice-toast" role="status">{notice}</div>}
      {achievementNotice && <div className="achievement-toast" role="status" aria-live="polite" key={`achievement-${achievementNotice.id}`}><i aria-hidden="true">◆</i><span>成就解锁 · 已存入跨轮回档案</span><strong>{achievementNotice.names.join('、')}</strong></div>}
      {changeCue && <div className="change-cue" role="status" aria-live="assertive" key={`change-${changeCue.id}`}>{changeCue.money && <strong className={changeCue.money.startsWith('-') ? 'loss' : 'gain'}>{changeCue.money}<small>现金变化</small></strong>}{changeCue.time && <strong className="time">{changeCue.time}<small>时间流逝</small></strong>}</div>}

      {modal === 'guide' && (
        <Modal title="如何在停电以后活下去" onClose={() => setModal(null)} footer={<button className="primary-inline" onClick={() => setModal(null)} type="button">明白了</button>}>
          <div className="guide-grid">
            <section><b>01</b><h3>难度与借贷</h3><p>简易难度物资更多、危险更低。借贷能增加开局现金，但封锁后仍会到期、催收并提高危险，请把还款算进采购预算。</p></section>
            <section><b>02</b><h3>时间、休息与低状态</h3><p>行动会推进游戏时钟，到达日终自动结算；白天休息两小时可恢复体力。饱腹或水分过低会明显预警，并提高危险、损失精神与睡眠恢复。</p></section>
            <section><b>03</b><h3>物资、料理与档案</h3><p>物资会列明分类和状态点数。厨具允许自选食材，成功料理会记录配方；只在少数食物间交替也会累积熟悉与厌倦，新口味只能有限缓解。</p></section>
            <section><b>04</b><h3>愿望、委托与结局</h3><p>愿望达成后在夜间结算，额外的每日委托完成即加点；两者都没有失败惩罚。最后一天由你选择撤离路线。</p></section>
          </div>
        </Modal>
      )}

      {modal === 'settings' && (
        <Modal title="阅读与操作设置" onClose={() => setModal(null)} footer={<><button onClick={() => setModal('achievements')} type="button">查看成就档案</button><button className="primary-inline" onClick={() => setModal(null)} type="button">保存并关闭</button></>}>
          <div className="settings-list">
            <label><span><strong>夜间自动补充食物与饮水</strong><small>{screen === 'game' ? '立即应用于当前轮；关闭后请白天手动使用物资' : '应用于下一轮；简易默认开启，标准与艰难默认关闭'}</small></span><input type="checkbox" checked={screen === 'game' && state ? state.autoRations : autoRations} onChange={(event) => { if (screen === 'game' && state) commit({ ...state, autoRations: event.target.checked, flags: event.target.checked ? [...new Set([...state.flags, 'auto-rations-used'])] : state.flags }); else setAutoRations(event.target.checked); }} /></label>
            <label><span><strong>数字键快捷操作</strong><small>按 1—9 选择底部对应选项</small></span><input type="checkbox" checked={settings.shortcuts} onChange={(event) => updateSettings({ shortcuts: event.target.checked })} /></label>
            <label><span><strong>减少动画</strong><small>关闭闪烁、过渡和脉冲效果</small></span><input type="checkbox" checked={settings.reducedMotion} onChange={(event) => updateSettings({ reducedMotion: event.target.checked })} /></label>
            <label><span><strong>高对比度</strong><small>加强边界与文字对比</small></span><input type="checkbox" checked={settings.highContrast} onChange={(event) => updateSettings({ highContrast: event.target.checked })} /></label>
            <label><span><strong>显示新手提示</strong><small>新开一轮时显示系列玩法提示</small></span><input type="checkbox" checked={settings.tutorial} onChange={(event) => updateSettings({ tutorial: event.target.checked })} /></label>
            <label className="select-setting"><span><strong>正文字号</strong><small>只影响游戏正文与记录</small></span><select value={settings.fontScale} onChange={(event) => updateSettings({ fontScale: event.target.value as SettingsState['fontScale'] })}><option value="small">紧凑</option><option value="normal">标准</option><option value="large">较大</option></select></label>
          </div>
        </Modal>
      )}

      {modal === 'achievements' && (
        <Modal title="跨轮回成就档案" onClose={() => setModal(null)} footer={<button className="primary-inline" onClick={() => setModal(null)} type="button">关闭档案</button>}>
          <AchievementGallery meta={meta} state={state ?? saved} />
        </Modal>
      )}

      {modal === 'restart' && (
        <Modal title="确认开始新一轮？" onClose={() => setModal(null)} footer={<><button type="button" onClick={() => setModal(null)}>保留当前进度</button><button className="danger-inline" type="button" onClick={() => { clearGame(window.localStorage); setSaved(null); startFresh(); }}>放弃并重新开始</button></>}>
          <p className="confirm-copy">当前本轮进度会被覆盖；累计记忆、永久能力和已见结局会保留。这个操作无法撤销。</p>
        </Modal>
      )}
    </div>
  );
}
