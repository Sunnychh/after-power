'use client';

import { ACHIEVEMENTS } from '../game/data/achievements.ts';
import { achievementProgress } from '../game/engine/achievements.ts';
import type { GameState, MetaState } from '../game/types.ts';

export function AchievementGallery({ meta, state }: { meta: MetaState; state: GameState | null }) {
  const difficultyLabel = { easy: '简易专属', normal: '标准专属', hard: '艰难专属', 'all-three': '跨难度' } as const;
  return (
    <div className="achievement-gallery">
      <header className="achievement-summary">
        <div><span>ACHIEVEMENT ARCHIVE</span><strong>{meta.achievements.length} / {ACHIEVEMENTS.length}</strong></div>
        <p>成就是跨轮回的本地记录，不消耗记忆，也不改变数值平衡。当前局一旦达到条件就会自动解锁并保存。</p>
      </header>
      <div className="achievement-grid">
        {ACHIEVEMENTS.map((achievement) => {
          const unlocked = meta.achievements.includes(achievement.id);
          const progress = achievementProgress(achievement.id, state, meta);
          const concealed = achievement.hidden && !unlocked;
          return (
            <article key={achievement.id} className={unlocked ? 'unlocked' : 'locked'}>
              <header>
                <span>{concealed ? '加密记录' : achievement.difficulty ? `${difficultyLabel[achievement.difficulty]} · ${achievement.category}` : achievement.category}</span>
                <b>{unlocked ? '已解锁' : `${progress.current}/${progress.target}`}</b>
              </header>
              <h3>{concealed ? '████████' : achievement.name}</h3>
              <p>{concealed ? '这条记录仍被广播噪声遮蔽。' : unlocked ? achievement.description : achievement.requirement}</p>
              <progress value={progress.current} max={progress.target} aria-label={`${concealed ? '隐藏成就' : achievement.name}进度 ${progress.current}/${progress.target}`} />
              {unlocked && <small>{achievement.requirement}</small>}
            </article>
          );
        })}
      </div>
    </div>
  );
}
