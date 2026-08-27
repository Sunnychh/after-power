import test from 'node:test';
import assert from 'node:assert/strict';
import { clearGame, loadGame, loadMeta, saveGame, saveMeta } from '../game/engine/save.ts';
import { createInitialState, GAME_SAVE_KEY, LEGACY_GAME_SAVE_KEY, PREVIOUS_GAME_SAVE_KEY } from '../game/engine/state.ts';
import type { StorageLike } from '../game/types.ts';

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

test('存档可完整恢复待处理事件与随机状态', () => {
  const storage = new MemoryStorage();
  const state = createInitialState('save-roundtrip');
  state.money -= 20;
  state.flags.push('test-flag');
  saveGame(storage, state);
  assert.deepEqual(loadGame(storage), state);
});

test('损坏或未知版本存档安全回退', () => {
  const storage = new MemoryStorage();
  storage.setItem(GAME_SAVE_KEY, '{bad json');
  assert.equal(loadGame(storage), null);
  storage.setItem(GAME_SAVE_KEY, JSON.stringify({ version: 99 }));
  assert.equal(loadGame(storage), null);
});

test('恢复存档会清理重复日结日志、旧愿望点反馈与过时的基础加分', () => {
  const storage = new MemoryStorage();
  const state = createInitialState('normalize-daily-save');
  state.logs.push(
    { id: 'duplicate-a', dayLabel: '灾前第 1 天', title: '每日愿望结算', body: '旧结算 A', tone: 'system' },
    { id: 'duplicate-b', dayLabel: '灾前第 1 天', title: '每日愿望结算', body: '旧结算 B', tone: 'system' },
  );
  state.feedback = [{ id: 'old-points', label: '愿望点', delta: 1, reason: '每日结算' }];
  state.dailyPlan = undefined;
  state.dailyPoints = 5;
  state.dailySettlement = {
    id: 'legacy-settlement',
    dayKey: 'prep:1',
    dayLabel: '灾前第 1 天',
    wishId: 'prep-income',
    wishAchieved: true,
    wishPoints: 2,
    deadlineId: 'early',
    deadlineAchieved: true,
    deadlinePoints: 2,
    basePoints: 1,
    earnedPoints: 5,
    completedAtMinutes: 12 * 60,
    endedAtMinutes: 22 * 60,
    rewardChoices: ['quiet-rest'],
    finalNight: false,
  };
  saveGame(storage, state);

  const restored = loadGame(storage)!;
  assert.equal(restored.logs.filter((log) => log.title === '每日愿望结算').length, 1);
  assert.equal(new Set(restored.logs.map((log) => log.id)).size, restored.logs.length);
  assert.equal(restored.feedback.some((item) => item.label === '愿望点'), false);
  assert.equal(restored.dailyPoints, 2);
  assert.equal(restored.dailySettlement?.earnedPoints, 2);
  assert.equal(restored.dailySettlement?.basePoints, 0);
  assert.equal(restored.dailySettlement?.deadlinePoints, 0);
});

test('v1 存档迁移为标准难度时钟制并保留进度', () => {
  const storage = new MemoryStorage();
  const current = createInitialState('legacy');
  current.money = 321;
  current.flags.push('legacy-flag');
  const legacy = structuredClone(current) as unknown as Record<string, unknown>;
  legacy.version = 1;
  legacy.actionPoints = 1;
  legacy.maxActionPoints = 3;
  delete legacy.difficulty;
  delete legacy.clockMinutes;
  delete legacy.furniture;
  delete legacy.autoRations;
  storage.setItem(LEGACY_GAME_SAVE_KEY, JSON.stringify(legacy));
  const migrated = loadGame(storage);
  assert.equal(migrated?.version, 3);
  assert.equal(migrated?.difficulty, 'normal');
  assert.equal(migrated?.money, 321);
  assert.ok(migrated?.flags.includes('legacy-flag'));
  assert.equal(migrated?.furniture.microwave.enabled, true);
  assert.equal(migrated?.dailyPoints, 0);
  assert.equal(migrated?.autoRations, false);
});

test('v2 存档迁移为 v3 每日愿望系统且保留当前局', () => {
  const storage = new MemoryStorage();
  const current = createInitialState('v2-migration', [], 0, 'easy');
  current.money = 456;
  const version2 = structuredClone(current) as unknown as Record<string, unknown>;
  version2.version = 2;
  delete version2.dailyPoints;
  delete version2.dailyPlan;
  delete version2.dailySettlement;
  delete version2.autoRations;
  storage.setItem(PREVIOUS_GAME_SAVE_KEY, JSON.stringify(version2));
  const migrated = loadGame(storage);
  assert.equal(migrated?.version, 3);
  assert.equal(migrated?.difficulty, 'easy');
  assert.equal(migrated?.money, 456);
  assert.equal(migrated?.dailyPoints, 0);
  assert.equal(migrated?.dailyPlan?.dayKey, 'prep:1');
  assert.equal(migrated?.dailyPlan?.deadlineId, 'open');
  assert.equal(migrated?.autoRations, true);
});

test('损坏的新键不会回退并复活旧存档', () => {
  const storage = new MemoryStorage();
  storage.setItem(GAME_SAVE_KEY, '{bad json');
  storage.setItem(LEGACY_GAME_SAVE_KEY, JSON.stringify({ version: 1, runId: 'old' }));
  assert.equal(loadGame(storage), null);
});

test('清除本轮不影响轮回记忆', () => {
  const storage = new MemoryStorage();
  const state = createInitialState('clear');
  saveGame(storage, state);
  const meta = { version: 1 as const, memory: 4, runs: 1, unlocked: ['packer' as const], endings: ['death' as const], awardedRuns: ['run-x'] };
  saveMeta(storage, meta);
  clearGame(storage);
  assert.equal(loadGame(storage), null);
  assert.equal(storage.getItem(GAME_SAVE_KEY), null);
  assert.equal(storage.getItem(PREVIOUS_GAME_SAVE_KEY), null);
  assert.equal(storage.getItem(LEGACY_GAME_SAVE_KEY), null);
  assert.deepEqual(loadMeta(storage), meta);
});
