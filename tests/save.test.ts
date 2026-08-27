import test from 'node:test';
import assert from 'node:assert/strict';
import { clearGame, loadGame, loadMeta, saveGame, saveMeta } from '../game/engine/save.ts';
import { createInitialState, GAME_SAVE_KEY, LEGACY_GAME_SAVE_KEY, PREVIOUS_GAME_SAVE_KEY } from '../game/engine/state.ts';
import type { StorageLike } from '../game/types.ts';
import { visitStore } from '../game/engine/actions.ts';

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

test('旧存档缺少供电策略或含旧式高等级时会安全折算', () => {
  const storage = new MemoryStorage();
  const state = createInitialState('power-save-normalize');
  state.shelter.generator = 7;
  state.shelter.power = 31;
  const legacyShape = structuredClone(state) as unknown as Record<string, unknown>;
  delete legacyShape.powerPolicy;
  storage.setItem(GAME_SAVE_KEY, JSON.stringify(legacyShape));
  const restored = loadGame(storage)!;
  assert.equal(restored.powerPolicy, 'balanced');
  assert.equal(restored.shelter.generator, 3);
  assert.equal(restored.shelter.power, 31);
});

test('存档可恢复贷款余额、还款与催收进度', () => {
  const storage = new MemoryStorage();
  const state = createInitialState('debt-save', [], 0, 'normal', false, 'bridge');
  state.debt!.balance = 311;
  state.debt!.missedCollections = 2;
  state.debt!.totalRepaid = 77;
  saveGame(storage, state);
  assert.deepEqual(loadGame(storage)?.debt, state.debt);
});

test('商店内刷新会恢复同一次采购行程，跨日的陈旧行程会被清理', () => {
  const storage = new MemoryStorage();
  const state = createInitialState('shopping-save');
  state.currentEventId = undefined;
  const shopping = visitStore(state, 'market').state;
  saveGame(storage, shopping);
  assert.deepEqual(loadGame(storage)?.shoppingTrip, shopping.shoppingTrip);

  const stale = structuredClone(shopping);
  stale.prepDay += 1;
  saveGame(storage, stale);
  assert.equal(loadGame(storage)?.shoppingTrip, undefined);
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

test('恢复存档会修复终局互斥状态与碰撞日志 ID', () => {
  const storage = new MemoryStorage();
  const state = createInitialState('normalize-ending-save', [], 0, 'normal', false, 'bridge');
  state.phase = 'ended';
  state.outcome = {
    id: 'death', variantId: 'death-collapse', title: '你的记录停在这一页', text: '身体抵达极限。', memoryEarned: 1, keyChoices: ['健康归零'],
  };
  state.flags.push('survived-goal-night', 'evacuation-choice-pending', 'ending:truth', 'ending:truth');
  state.dailySettlement = {
    id: 'stale', dayKey: 'survival:14', dayLabel: '封锁第 14 天', wishId: 'survival-care', wishAchieved: false,
    wishPoints: 0, deadlineId: 'open', deadlineAchieved: false, deadlinePoints: 0, basePoints: 0, earnedPoints: 0,
    endedAtMinutes: 21 * 60, rewardChoices: ['quiet-rest'], finalNight: true,
  };
  state.logs.push(
    { ...state.logs[0], id: state.logs[0].id, title: '重复 ID' },
    { ...state.logs[0], id: `${state.runId}-restored-log-1`, title: '占用修复 ID' },
    { ...state.logs[0], id: state.logs[0].id, title: '再次重复 ID' },
  );
  saveGame(storage, state);

  const restored = loadGame(storage)!;
  assert.equal(new Set(restored.logs.map((log) => log.id)).size, restored.logs.length);
  assert.equal(restored.flags.includes('survived-goal-night'), false);
  assert.equal(restored.flags.includes('evacuation-choice-pending'), false);
  assert.equal(restored.flags.some((flag) => flag.startsWith('ending:')), false);
  assert.equal(restored.dailyPlan, undefined);
  assert.equal(restored.dailySettlement, undefined);
  assert.equal(restored.currentEventId, undefined);
  assert.deepEqual(restored.feedback, []);
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
  delete legacy.cookingAttempts;
  delete legacy.cookingSkill;
  delete legacy.isolationNights;
  delete legacy.storePurchases;
  delete legacy.shoppingTrip;
  storage.setItem(LEGACY_GAME_SAVE_KEY, JSON.stringify(legacy));
  const migrated = loadGame(storage);
  assert.equal(migrated?.version, 3);
  assert.equal(migrated?.difficulty, 'normal');
  assert.equal(migrated?.money, 321);
  assert.ok(migrated?.flags.includes('legacy-flag'));
  assert.equal(migrated?.furniture.microwave.enabled, true);
  assert.equal(migrated?.dailyPoints, 0);
  assert.equal(migrated?.autoRations, false);
  assert.equal(migrated?.cookingAttempts, 0);
  assert.equal(migrated?.cookingSkill, 0);
  assert.equal(migrated?.isolationNights, 0);
  assert.deepEqual(migrated?.storePurchases, {});
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
  delete version2.cookingAttempts;
  delete version2.cookingSkill;
  delete version2.isolationNights;
  delete version2.storePurchases;
  delete version2.shoppingTrip;
  storage.setItem(PREVIOUS_GAME_SAVE_KEY, JSON.stringify(version2));
  const migrated = loadGame(storage);
  assert.equal(migrated?.version, 3);
  assert.equal(migrated?.difficulty, 'easy');
  assert.equal(migrated?.money, 456);
  assert.equal(migrated?.dailyPoints, 0);
  assert.equal(migrated?.dailyPlan?.dayKey, 'prep:1');
  assert.equal(migrated?.dailyPlan?.deadlineId, 'open');
  assert.equal(migrated?.autoRations, true);
  assert.equal(migrated?.cookingAttempts, 0);
  assert.equal(migrated?.cookingSkill, 0);
  assert.equal(migrated?.isolationNights, 0);
  assert.deepEqual(migrated?.storePurchases, {});
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
