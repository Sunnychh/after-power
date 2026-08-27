'use client';

import { ABILITIES } from '../game/data/world.ts';
import { DIFFICULTIES } from '../game/data/difficulties.ts';
import type { AbilityId, DifficultyId, MetaState } from '../game/types.ts';

export function TitleScreen({ hasSave, seed, difficulty, meta, onSeedChange, onDifficultyChange, onStart, onContinue, onGuide, onSettings, onUnlock }: {
  hasSave: boolean;
  seed: string;
  difficulty: DifficultyId;
  meta: MetaState;
  onSeedChange: (seed: string) => void;
  onDifficultyChange: (difficulty: DifficultyId) => void;
  onStart: () => void;
  onContinue: () => void;
  onGuide: () => void;
  onSettings: () => void;
  onUnlock: (ability: AbilityId, cost: number) => void;
}) {
  return (
    <main className="title-screen">
      <div className="signal-noise" aria-hidden="true" />
      <header className="title-status">
        <span>城市应急广播 / 频道 07</span>
        <span className="signal"><i /> 信号微弱</span>
      </header>

      <section className="title-card" aria-labelledby="game-title">
        <p className="eyebrow">第 {meta.runs + 1} 轮 · 距离封锁还有 7 天</p>
        <h1 id="game-title">断电以后</h1>
        <p className="subtitle">用七天准备封锁，在停电后的城市里撑到撤离。死亡会留下少量记忆。</p>
        <div className="broadcast">
          <span className="broadcast-mark">07:42</span>
          <p>“……请市民保持正常生活。关于未知传染病的消息均未经证实。”</p>
        </div>
        <section className="difficulty-picker" aria-labelledby="difficulty-title">
          <div className="difficulty-heading"><span>开局难度</span><small id="difficulty-title">每一轮开始前都可重新选择</small></div>
          <div className="difficulty-grid">
            {DIFFICULTIES.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={difficulty === entry.id ? 'selected' : ''}
                aria-pressed={difficulty === entry.id}
                onClick={() => onDifficultyChange(entry.id)}
              >
                <span><strong>{entry.name}</strong>{entry.id === 'easy' && <em>推荐</em>}</span>
                <b>{entry.tagline}</b>
                <small>{entry.description}</small>
              </button>
            ))}
          </div>
        </section>
        <label className="seed-field">
          <span>本轮种子</span>
          <input value={seed} maxLength={32} onChange={(event) => onSeedChange(event.target.value)} aria-describedby="seed-help" />
          <small id="seed-help">相同种子与选择会得到相同天气、事件和危险判定。</small>
        </label>
        <button className="primary-action" type="button" onClick={onStart}>
          <span>{meta.runs ? '开始新一轮' : '开始第一轮'}</span>
          <kbd>Enter</kbd>
        </button>
        <div className="title-links" aria-label="辅助选项">
          <button type="button" disabled={!hasSave} onClick={onContinue}>继续游戏{!hasSave ? ' · 无存档' : ''}</button>
          <button type="button" onClick={onGuide}>如何生存</button>
          <button type="button" onClick={onSettings}>设置</button>
        </div>

        {(meta.memory > 0 || meta.unlocked.length > 0) && (
          <section className="memory-panel" aria-labelledby="memory-title">
            <div className="memory-heading"><span className="section-kicker">LOOP MEMORY</span><h2 id="memory-title">残留记忆 <b>{meta.memory}</b></h2></div>
            <div className="ability-list">
              {ABILITIES.map((ability) => {
                const unlocked = meta.unlocked.includes(ability.id);
                return (
                  <button key={ability.id} type="button" disabled={unlocked || meta.memory < ability.cost} onClick={() => onUnlock(ability.id, ability.cost)}>
                    <span><strong>{ability.name}</strong><small>{ability.description}</small></span>
                    <em>{unlocked ? '已解锁' : `${ability.cost} 记忆`}</em>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </section>

      <footer className="title-footer">
        <span>本地自动存档</span>
        <span>原创纯文字生存游戏 · v0.3</span>
      </footer>
    </main>
  );
}
