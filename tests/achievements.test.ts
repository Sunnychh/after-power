import test from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS } from '../game/data/achievements.ts';
import { LOCATIONS } from '../game/data/world.ts';
import { achievementProgress, evaluateAchievements } from '../game/engine/achievements.ts';
import { loadMeta, saveMeta } from '../game/engine/save.ts';
import { createInitialState, DEFAULT_META, META_SAVE_KEY } from '../game/engine/state.ts';
import type { MetaState, StorageLike } from '../game/types.ts';

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

function meta(): MetaState {
  return structuredClone(DEFAULT_META);
}

test('成就定义数量、ID 与名称保持唯一且覆盖六类玩法', () => {
  assert.equal(ACHIEVEMENTS.length, 15);
  assert.equal(new Set(ACHIEVEMENTS.map((achievement) => achievement.id)).size, ACHIEVEMENTS.length);
  assert.equal(new Set(ACHIEVEMENTS.map((achievement) => achievement.name)).size, ACHIEVEMENTS.length);
  assert.deepEqual(
    [...new Set(ACHIEVEMENTS.map((achievement) => achievement.category))].sort(),
    ['关系', '挑战', '探索', '料理', '生存', '结局'].sort(),
  );
});

test('当前局达到探索、料理与结盟条件时自动解锁，重复判定不会重复发放', () => {
  const state = createInitialState('achievement-bundle');
  state.phase = 'survival';
  state.survivalDay = 2;
  for (const location of LOCATIONS.slice(0, 3)) state.visited[location.id] = 1;
  state.explorationSkills.search = { level: 3, xp: 9 };
  state.discoveredRecipes = Array.from({ length: 8 }, (_, index) => `test-recipe-${index}`);
  state.cookingSkill = 3;
  state.flags.push('npc-allied:lin-zhou');

  const first = evaluateAchievements(meta(), state);
  const unlockedIds = first.unlocked.map((achievement) => achievement.id);
  for (const id of ['first-night', 'district-scout', 'field-specialist', 'first-recipe', 'seasoned-cook', 'recipe-collector', 'first-alliance'] as const) {
    assert.ok(unlockedIds.includes(id), `应解锁 ${id}`);
  }
  assert.equal(unlockedIds.includes('city-cartographer'), false);

  const repeated = evaluateAchievements(first.meta, state);
  assert.deepEqual(repeated.unlocked, []);
  assert.deepEqual(repeated.meta.achievements, first.meta.achievements);
});

test('艰难难度主动防线与非死亡结局拥有独立成就', () => {
  const state = createInitialState('achievement-hard', [], 0, 'hard');
  state.phase = 'ended';
  state.survivalDay = 14;
  state.powerTrap = { level: 2, armed: true };
  state.outcome = {
    id: 'survivor',
    variantId: 'survivor-test',
    title: '普通结局',
    text: '测试结局。',
    memoryEarned: 3,
    keyChoices: ['撑到撤离'],
  };
  const result = evaluateAchievements(meta(), state);
  const ids = result.unlocked.map((achievement) => achievement.id);
  assert.ok(ids.includes('live-wire'));
  assert.ok(ids.includes('hard-survivor'));
  assert.ok(ids.includes('ending-survivor'));
});

test('隐藏结局成就与三类结局收藏使用跨轮回 Meta 进度', () => {
  const currentMeta = meta();
  currentMeta.endings = ['death', 'survivor'];
  const state = createInitialState('achievement-truth');
  state.phase = 'ended';
  state.survivalDay = 14;
  state.outcome = {
    id: 'truth',
    variantId: 'truth-test',
    title: '隐藏结局',
    text: '测试真相结局。',
    memoryEarned: 5,
    keyChoices: ['送出证据'],
  };
  const result = evaluateAchievements(currentMeta, state);
  const ids = result.unlocked.map((achievement) => achievement.id);
  assert.ok(ids.includes('ending-death'));
  assert.ok(ids.includes('ending-survivor'));
  assert.ok(ids.includes('ending-truth'));
  assert.ok(ids.includes('ending-collection'));
  assert.equal(achievementProgress('ending-collection', state, result.meta).current, 3);
});

test('没有当前局存档时也会从旧 Meta 的结局记录回填成就', () => {
  const currentMeta = meta();
  currentMeta.endings = ['death', 'survivor', 'truth'];
  const result = evaluateAchievements(currentMeta, null);
  assert.deepEqual(
    result.unlocked.map((achievement) => achievement.id).sort(),
    ['ending-death', 'ending-survivor', 'ending-truth', 'ending-collection'].sort(),
  );
});

test('旧版 Meta 无成就字段时兼容为空，新字段会持久化并过滤未知 ID', () => {
  const storage = new MemoryStorage();
  storage.setItem(META_SAVE_KEY, JSON.stringify({
    version: 1,
    memory: 2,
    runs: 1,
    unlocked: [],
    endings: ['death'],
    awardedRuns: ['old-run'],
  }));
  assert.deepEqual(loadMeta(storage).achievements, []);

  const next = meta();
  next.achievements = ['first-night', 'ending-death'];
  saveMeta(storage, next);
  const raw = JSON.parse(storage.getItem(META_SAVE_KEY)!) as { achievements: string[] };
  raw.achievements.push('unknown-achievement', 'constructor', 'first-night');
  storage.setItem(META_SAVE_KEY, JSON.stringify(raw));
  assert.deepEqual(loadMeta(storage).achievements, ['first-night', 'ending-death']);
});
