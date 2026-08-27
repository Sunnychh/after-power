'use client';

import { useState } from 'react';
import { DIFFICULTY_MAP } from '../game/data/difficulties.ts';
import { DAILY_REWARD_MAP, DAILY_WISH_MAP } from '../game/data/daily.ts';
import { EVENT_MAP } from '../game/data/events.ts';
import { formatItemEffects, STORE_DESCRIPTIONS, STORE_NAMES } from '../game/data/items.ts';
import { LOCATIONS, NPCS } from '../game/data/world.ts';
import {
  availableStoreItems,
  endDay,
  eventOptionDisabledReason,
  exploreLocation,
  exploreSubstationControl,
  performPrepAction,
  performSurvivalAction,
  purchaseItem,
  resolveCurrentEvent,
  substationControlAccess,
  useItem as consumeGameItem,
  visitStore,
  type PrepActionId,
} from '../game/engine/actions.ts';
import { furnitureActionDisabledReason, performFurnitureAction, type FurnitureActionId } from '../game/engine/furniture.ts';
import { inventoryCount } from '../game/engine/inventory.ts';
import { isNpcUnlocked } from '../game/engine/npcs.ts';
import { claimDailyReward, continueAfterMissedWish, dailyWishProgress } from '../game/engine/daily.ts';
import { chooseEvacuation, truthEndingReady, truthEvidenceCount, trustedNpcCount } from '../game/engine/outcomes.ts';
import { clamp } from '../game/engine/state.ts';
import { dayEndMinutes, formatClock, formatDuration, minutesRemaining, timeDisabledReason } from '../game/engine/time.ts';
import type { GameState, SettingsState, StoreId } from '../game/types.ts';
import { ActionPanel, type ActionChoice } from './ActionPanel.tsx';
import { InventoryPanel } from './InventoryPanel.tsx';
import { Modal } from './Modal.tsx';
import { StatusBar, StatusDock } from './StatusBar.tsx';

type Mode = 'main' | 'shops' | 'explore' | 'craft' | 'trade';
type EngineResult = { state: GameState; ok: boolean; message?: string };

const TUTORIAL = [
  { title: '状态就在右下', body: '健康、水分、饱腹、精神、体力和避难所状态固定在右下。低于 40 会影响危险判定。' },
  { title: '钟点决定一天', body: '每个行动会推进游戏内时钟，到达日终自动进入夜间结算。休息两小时可以恢复体力。' },
  { title: '每件物资都标保存期', body: '易腐物会按入库批次显示“剩余 N 天”或“今天到期”，其他物资会标为长期保存；冰箱会逐批延长仍有效的保质期。' },
  { title: '每天一个明确愿望', body: '系统每天直接给出一件当天能完成的事。达成后夜间领取奖励；没有完成也不会扣除任何状态或点数。' },
  { title: '结局由你决定', body: '证据发送成功不会自动覆盖普通撤离。最后一天会明确让你选择离城路线，结局文案也会回应关键经历。' },
];

function timedReason(state: GameState, minutes: number): string | null {
  return timeDisabledReason(state, minutes);
}

export function GameView({ state, settings, savedAt, onResult, onCommit, onSettings, onRestart, onReturnTitle, onNextRound }: {
  state: GameState;
  settings: SettingsState;
  savedAt: string;
  onResult: (result: EngineResult) => boolean;
  onCommit: (state: GameState) => void;
  onSettings: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
  onNextRound: () => void;
}) {
  const [mode, setMode] = useState<Mode>('main');
  const [shop, setShop] = useState<StoreId | null>(null);
  const [drawer, setDrawer] = useState(false);
  const event = state.currentEventId ? EVENT_MAP[state.currentEventId] : undefined;
  const difficultyConfig = DIFFICULTY_MAP[state.difficulty];
  const activeWish = state.dailyPlan ? DAILY_WISH_MAP[state.dailyPlan.wishId] : undefined;
  const settlementWish = state.dailySettlement ? DAILY_WISH_MAP[state.dailySettlement.wishId] : undefined;

  const run = (result: EngineResult) => {
    const ok = onResult(result);
    if (ok) setMode('main');
    return ok;
  };

  const choices = (() : ActionChoice[] => {
    if (state.phase === 'ended') {
      return [
        { id: 'title', label: '回到标题页', hint: '查看记忆与永久能力', onSelect: onReturnTitle },
        { id: 'next', label: '设置下一轮难度', hint: '回到标题页；记忆与永久能力会保留', onSelect: onNextRound },
      ];
    }
    if (state.dailySettlement) {
      if (!state.dailySettlement.wishAchieved) {
        return [{
          id: 'continue-after-wish',
          label: '接受今日结果，继续',
          hint: '未完成愿望没有惩罚，也不会消耗已有愿望点',
          onSelect: () => run(continueAfterMissedWish(state)),
        }];
      }
      return state.dailySettlement.rewardChoices.map((rewardId) => {
        const reward = DAILY_REWARD_MAP[rewardId];
        return {
          id: reward.id,
          label: reward.name,
          hint: `${reward.cost} 愿望点 · ${reward.description}`,
          disabledReason: state.dailyPoints < reward.cost ? `愿望点不足（需要 ${reward.cost}）` : undefined,
          onSelect: () => run(claimDailyReward(state, reward.id)),
        };
      });
    }
    if (state.flags.includes('evacuation-choice-pending')) {
      return [
        {
          id: 'evacuate-west',
          label: '跟随西侧通道撤离',
          hint: '进入普通幸存结局；已经发送的证据不会替你强制选择路线',
          onSelect: () => run(chooseEvacuation(state, 'survivor')),
        },
        {
          id: 'evacuate-truth',
          label: '护送证据穿过维修通道',
          hint: '结局会根据证据来源与同行盟友产生变化',
          disabledReason: state.flags.includes('truth-transmitted') ? undefined : '证据没有成功发出，维修通道路线未建立',
          onSelect: () => run(chooseEvacuation(state, 'truth')),
        },
      ];
    }
    if (event) {
      return event.options.map((option, index) => ({
        id: `${event.id}-${index}`,
        label: option.label,
        hint: option.hint,
        disabledReason: eventOptionDisabledReason(state, index),
        danger: option.danger ? option.danger < 25 ? '低风险' : option.danger < 50 ? '中风险' : '高风险' : undefined,
        onSelect: () => run(resolveCurrentEvent(state, index)),
      }));
    }
    if (state.phase === 'prep') {
      if (mode === 'shops') {
        const storeChoices: ActionChoice[] = ([
          ['market', '河西生活超市', '食物、饮水与日用品'],
          ['pharmacy', '青禾药房', '药品、防护与净水用品'],
          ['hardware', '老潘五金行', '工具、材料与供电设备'],
          ['fuel', '环路加油站', '密封燃料，价格不便宜'],
        ] as Array<[StoreId, string, string]>).map(([id, label, hint]) => ({
          id,
          label,
          hint: `1小时30分 · ${hint}`,
          disabledReason: timedReason(state, 120),
          onSelect: () => {
            const result = visitStore(state, id);
            if (onResult(result)) setShop(id);
          },
        }));
        return [...storeChoices, { id: 'back', label: '返回准备清单', hint: '不耗时', onSelect: () => setMode('main') }];
      }
      const prep = (id: PrepActionId, label: string, hint: string, minutes: number, extra?: string | null): ActionChoice => ({
        id,
        label,
        hint: `${formatDuration(minutes)} · ${hint}`,
        disabledReason: timedReason(state, minutes) ?? extra,
        onSelect: () => run(performPrepAction(state, id)),
      });
      return [
        prep('work', '临时加班', '金钱 +¥170 · 体力 -18', 240, state.flags.includes(`worked:${state.prepDay}`) ? '今天已经工作过' : null),
        { id: 'shops', label: '前往商店采购', hint: '1小时30分 · 到店后可连续购买', disabledReason: timedReason(state, 120), onSelect: () => setMode('shops') },
        prep('reinforce', '加固门窗', '¥70 · 完整度 +15', 180, state.money < 70 ? '金钱不足（需要 ¥70）' : null),
        prep('water', '改造储水', '¥90 · 储水 +18', 180, state.money < 90 ? '金钱不足（需要 ¥90）' : null),
        prep('power', '改善供电', '¥110 · 备用电力 +8', 180, state.money < 110 ? '金钱不足（需要 ¥110）' : null),
        prep('investigate', '调查灾难情报', '情报 +1 · 降低探索危险', 120),
        prep('contact', '给邻居逐户留言', '灾后首次建立广播联络时获得初始信任', 90),
        prep('rest', '休息片刻', '体力 +25 · 精神 +5', 120),
        { id: 'end', label: '就寝并进入下一天', hint: `现在 ${formatClock(state.clockMinutes)} · 推进至 ${formatClock(dayEndMinutes(state))} 后结算`, onSelect: () => run(endDay(state)) },
      ];
    }

    if (mode === 'explore') {
      const locationChoices: ActionChoice[] = LOCATIONS.map((location) => {
        const adjusted = clamp(location.risk + difficultyConfig.riskModifier + (state.survivalDay - 1) * 2 - state.intel * 3 - (state.flags.includes('ability:map') ? 8 : 0), 5, 85);
        return {
          id: location.id,
          label: location.name,
          hint: `${location.district} · 4小时 · ${state.visited[location.id] ? `已探索 ${state.visited[location.id]} 次` : '首次可发现线索'}`,
          danger: adjusted < 30 ? '低风险' : adjusted < 55 ? '中风险' : '高风险',
          disabledReason: timedReason(state, 240),
          onSelect: () => run(exploreLocation(state, location.id)),
        };
      });
      const controlAccess = substationControlAccess(state);
      const controlChoice: ActionChoice = {
        id: 'north-substation-control',
        label: '支线 · 变电站控制层',
        hint: controlAccess.method === 'key'
          ? '3小时 · 铜钥匙进入（钥匙保留）· 样本证据与备用电力'
          : controlAccess.method === 'route'
            ? '3小时 · 从备用入口潜入 · 样本证据与备用电力'
            : '3小时 · 隐藏区域 · 样本证据与备用电力',
        danger: controlAccess.method === 'key' ? '低风险' : controlAccess.method === 'route' ? '高风险' : undefined,
        disabledReason: controlAccess.available ? timedReason(state, 180) : controlAccess.reason,
        onSelect: () => run(exploreSubstationControl(state)),
      };
      return [...locationChoices, controlChoice, { id: 'back', label: '返回避难所行动', hint: '不耗时', onSelect: () => setMode('main') }];
    }
    if (mode === 'craft') {
      const furnitureChoice = (id: FurnitureActionId, label: string, hint: string): ActionChoice => ({
        id,
        label,
        hint,
        disabledReason: furnitureActionDisabledReason(state, id),
        onSelect: () => run(performFurnitureAction(state, id)),
      });
      return [
        furnitureChoice('gas-stove', '燃气炉 · 煮一碗面', '1小时 · 面和水 -1 · 燃料 -2 · 饱腹 +38'),
        furnitureChoice('microwave', '微波炉 · 加热罐头', '20分钟 · 罐头 -1 · 电力 -2 · 饱腹 +42'),
        furnitureChoice('electric-hotpot', '电火锅 · 煮热汤', '1小时30分 · 面和水 -1 · 电力 -3 · 全面恢复'),
        { id: 'barricade', label: '木板加固', hint: '2小时 · 木板 -1 · 完整度 +20', disabledReason: timedReason(state, 120) ?? (inventoryCount(state.inventory, 'wood-board') < 1 ? '缺少木板 ×1' : null), onSelect: () => run(performSurvivalAction(state, 'barricade')) },
        { id: 'cook', label: '燃气炉 · 煮一锅米饭', hint: '1小时30分 · 米和水 -1 · 燃料 -2 · 饱腹 +48', disabledReason: timedReason(state, 90) ?? (inventoryCount(state.inventory, 'rice') < 1 ? '缺少真空米砖' : inventoryCount(state.inventory, 'water-bottle') < 1 ? '缺少瓶装水' : state.shelter.fuel < 2 ? '燃料不足 2' : null), onSelect: () => run(performSurvivalAction(state, 'cook')) },
        { id: 'purify', label: '处理雨水', hint: '1小时30分 · 净水片、滤布、储水 6 → 瓶装水 2', disabledReason: timedReason(state, 90) ?? (inventoryCount(state.inventory, 'purifier-tablet') < 1 ? '缺少净水片' : inventoryCount(state.inventory, 'filter-cloth') < 1 ? '缺少活性炭滤布' : state.shelter.water < 6 ? '储水不足 6' : null), onSelect: () => run(performSurvivalAction(state, 'purify')) },
        { id: 'back', label: '返回避难所行动', hint: '不耗时', onSelect: () => setMode('main') },
      ];
    }
    if (mode === 'trade') {
      return [
        { id: 'trade-water', label: '用巧克力换水', hint: '1小时 · 巧克力 -1 · 瓶装水 +2', disabledReason: timedReason(state, 60) ?? (!isNpcUnlocked(state, 'chen-meng') ? '需要先通过广播联络陈檬' : inventoryCount(state.inventory, 'chocolate') < 1 ? '缺少巧克力' : null), onSelect: () => run(performSurvivalAction(state, 'trade-water')) },
        { id: 'trade-med', label: '用电池换绷带', hint: '1小时 · 电池 -1 · 绷带 +1', disabledReason: timedReason(state, 60) ?? (!isNpcUnlocked(state, 'lin-zhou') ? '需要先通过广播联络林舟' : inventoryCount(state.inventory, 'batteries') < 1 ? '缺少电池组' : null), onSelect: () => run(performSurvivalAction(state, 'trade-med')) },
        { id: 'back', label: '返回避难所行动', hint: '不耗时', onSelect: () => setMode('main') },
      ];
    }
    const radioMinutes = state.shelter.power >= 2 || inventoryCount(state.inventory, 'batteries') > 0 ? 60 : 120;
    const truthDay = difficultyConfig.truthDecisionDay;
    return [
      { id: 'rest', label: '休息两小时', hint: '2小时 · 体力 +32 · 精神 +4', disabledReason: timedReason(state, 120), onSelect: () => run(performSurvivalAction(state, 'rest')) },
      { id: 'repair', label: '修缮避难所', hint: '2小时 · 有工具与胶带时完整度 +16', disabledReason: timedReason(state, 120), onSelect: () => run(performSurvivalAction(state, 'repair')) },
      { id: 'craft', label: '家具、烹饪与制作', hint: '使用自带厨房家具，或进行净水和加固', disabledReason: minutesRemaining(state) < 20 ? '今天已没有制作时间' : null, onSelect: () => setMode('craft') },
      { id: 'radio', label: '收听广播', hint: `${formatDuration(radioMinutes)} · 优先耗电 2 或电池 1`, disabledReason: timedReason(state, radioMinutes) ?? (inventoryCount(state.inventory, 'radio') < 1 ? '缺少短波收音机' : null), onSelect: () => run(performSurvivalAction(state, 'radio')) },
      { id: 'trade', label: '与幸存者交易', hint: '用稀缺物资交换水或药品', disabledReason: timedReason(state, 60), onSelect: () => setMode('trade') },
      { id: 'explore', label: '外出探索', hint: `4小时 · 选择 6 个地点之一 · ${state.difficulty === 'easy' ? '简易额外战利品 +1' : '危险受状态影响'}`, disabledReason: timedReason(state, 240), onSelect: () => setMode('explore') },
      { id: 'generator', label: '启动备用电源', hint: '30分钟 · 燃料 3 → 电力 +9', disabledReason: timedReason(state, 30) ?? (state.shelter.generator < 1 ? '未完成供电改造' : state.shelter.fuel < 3 ? '燃料不足 3' : null), onSelect: () => run(performSurvivalAction(state, 'generator')) },
      ...(state.survivalDay >= truthDay && state.flags.includes('truth-window-open') && !state.flags.includes('truth-attempted') ? [{ id: 'truth', label: '搭建外联中继', hint: '3小时 · 每轮只有一次发送窗口；失败后仍可普通撤离', disabledReason: truthEndingReady(state) ? timedReason(state, 180) : `需要证据 3（${truthEvidenceCount(state)}）、盟友 2（${trustedNpcCount(state)}）与已解码广播`, danger: '中风险', onSelect: () => run(performSurvivalAction(state, 'truth')) }] : []),
      { id: 'end', label: '就寝并进行夜间结算', hint: `现在 ${formatClock(state.clockMinutes)} · 尚余 ${formatDuration(minutesRemaining(state))}`, onSelect: () => run(endDay(state)) },
    ];
  })();

  const currentTitle = state.phase === 'ended'
    ? '本轮记录'
    : state.dailySettlement
      ? state.dailySettlement.wishAchieved ? '从今日结算中挑选一项奖励' : '确认今日愿望结果'
      : state.flags.includes('evacuation-choice-pending')
        ? '选择这一次如何离开'
        : event
              ? '必须作出选择'
              : mode === 'main'
                ? '安排接下来的时间'
                : mode === 'shops'
                  ? '选择采购地点'
                  : mode === 'explore'
                      ? '选择探索地点'
                      : mode === 'craft'
                        ? '家具、烹饪与制作'
                        : '选择交换方式';
  const actionSubtitle = state.dailySettlement
    ? state.dailySettlement.wishAchieved
      ? `愿望点余额 ${state.dailyPoints} · 选择一项今日奖励`
      : `今日奖励 +0 · 未完成没有惩罚`
    : state.flags.includes('evacuation-choice-pending')
      ? '结局由你选择，不会因满足隐藏条件自动覆盖普通撤离'
      : event
            ? '选择将耗时 30 分钟并写入日志'
            : `当前 ${formatClock(state.clockMinutes)} · 距日终 ${formatDuration(minutesRemaining(state))}`;

  return (
    <main className="game-screen">
      <StatusBar state={state} savedAt={savedAt} onOpenInventory={() => setDrawer(true)} onOpenSettings={onSettings} onRestart={onRestart} />
      {drawer && <button className="drawer-scrim" aria-label="关闭背包" onClick={() => setDrawer(false)} />}
      <div className="game-layout">
        <InventoryPanel state={state} open={drawer} onClose={() => setDrawer(false)} onUse={(itemId) => run(consumeGameItem(state, itemId))} />

        <section className="narrative-column" aria-label="当日叙事与历史日志">
          {state.feedback.length > 0 && (
            <div className="feedback-strip" aria-live="polite">
              {state.feedback.slice(-6).map((item) => <span key={item.id} className={item.delta < 0 ? 'negative' : 'positive'}>{item.label} {item.delta > 0 ? '+' : ''}{item.delta}<small>{item.reason}</small></span>)}
            </div>
          )}

          {state.phase === 'ended' && state.outcome ? (
            <article className={`current-story ending-card ending-${state.outcome.id}`}>
              <span className="story-time">RUN COMPLETE / {state.survivalDay} DAYS</span>
              <h2>{state.outcome.title}</h2>
              <p>{state.outcome.text}</p>
              <div className="ending-choices">{state.outcome.keyChoices.map((choice) => <span key={choice}>{choice}</span>)}</div>
              <div className="ending-memory"><span>本轮留下</span><strong>+{state.outcome.memoryEarned} 记忆</strong></div>
            </article>
          ) : state.dailySettlement && settlementWish ? (
            <article className="current-story daily-settlement-card">
              <span className="story-time">DAY SETTLEMENT / {state.dailySettlement.dayLabel}</span>
              <h2>{state.dailySettlement.wishAchieved ? `愿望达成 · +${state.dailySettlement.earnedPoints} 点` : '愿望未达成 · 无惩罚'}</h2>
              <p>{state.dailySettlement.wishAchieved
                ? `“${settlementWish.name}”在 ${formatClock(state.dailySettlement.completedAtMinutes!)} 达成。现在从下方挑一项奖励，剩余点数会保留到明天。`
                : `“${settlementWish.name}”今天没有完成。不会扣状态、资源或已有愿望点，确认后即可继续。`}</p>
              <dl className="settlement-breakdown">
                <div><dt>今日愿望</dt><dd>{state.dailySettlement.wishAchieved ? `+${state.dailySettlement.wishPoints}` : '+0'}</dd></div>
                <div><dt>未达成惩罚</dt><dd>0</dd></div>
                <div><dt>当前余额</dt><dd>{state.dailyPoints}</dd></div>
              </dl>
              {state.dailySettlement.finalNight && <span className="settlement-final-note">领取后，撤离通道会要求你亲自选择普通路线或证据路线。</span>}
            </article>
          ) : state.flags.includes('evacuation-choice-pending') ? (
            <article className="current-story evacuation-card">
              <span className="story-time">EVACUATION WINDOW / ROUTE CHOICE</span>
              <h2>西侧通道已经开放</h2>
              <p>{state.flags.includes('truth-transmitted')
                ? '证据已经送出，但这不会替你决定结局。你可以跟随公开撤离车队，也可以和同伴护送设备走维修通道。'
                : '公开撤离通道会开放四小时。证据路线没有建立，活着离开仍然是一个完整的选择。'}</p>
            </article>
          ) : event ? (
            <article className="current-story" tabIndex={-1}>
              <span className="story-time">{event.npc ? `${NPCS.find((npc) => npc.id === event.npc)?.name ?? '幸存者'} / ` : ''}即时事件</span>
              <h2>{event.title}</h2>
              <p>{event.text}</p>
              {event.chain && <span className="chain-tag">跨天线索 · {event.chain.id.toUpperCase()} / {event.chain.step}</span>}
            </article>
          ) : (
            <article className="current-story day-brief">
              <span className="story-time">TODAY / {state.weather} / {formatClock(state.clockMinutes)}</span>
              <h2>{state.phase === 'prep' ? `清单还剩 ${8 - state.prepDay} 天` : `封锁第 ${state.survivalDay} 天，门外仍有声音`}</h2>
              <p>{state.phase === 'prep'
                ? '城市还在照常运转。每一次出门都能换来钱、物资、情报或一段关系，但今天的时间只够做其中几件。'
                : state.survivalDay === 8 ? '尸潮已经抵达主路。今天的任何噪声、加固和盟友都会影响门能撑多久。' : '行动会推进游戏内时钟。抵达日终后自动结算饱腹、水分、天气、冰箱、供电与伤病，也可以提前就寝。'}</p>
            </article>
          )}

          <section className="log-section" aria-labelledby="log-title">
            <div className="section-heading"><span className="section-kicker">SURVIVAL LOG</span><h2 id="log-title">生存记录</h2></div>
            <div className="log-list">
              {[...state.logs].reverse().slice(0, 12).map((log, index) => (
                <article className={`log-entry tone-${log.tone} ${index === 0 ? 'latest' : ''}`} key={log.id}>
                  <div><span>{log.dayLabel}</span><h3>{log.title}</h3></div>
                  <p>{log.body}</p>
                </article>
              ))}
            </div>
          </section>
        </section>

        <aside className="brief-panel" aria-label="目标、天气与人物关系">
          <section className="daily-objective">
            <span className="section-kicker">DAILY PROMISE</span>
            <h2>今日愿望 · {state.dailyPoints} 点</h2>
            {state.dailySettlement ? (
              <p>{state.dailySettlement.wishAchieved ? '今天的愿望已经达成，请在下方领取一项奖励。' : '今天的愿望没有完成；没有惩罚，确认后继续。'}</p>
            ) : activeWish ? (
              <>
                <p><strong>{activeWish.name}</strong><br />{activeWish.description}</p>
                <dl className="daily-progress">
                  <div><dt>进度</dt><dd>{dailyWishProgress(state)}</dd></div>
                  <div><dt>达成奖励</dt><dd>+{activeWish.rewardPoints} 愿望点</dd></div>
                </dl>
              </>
            ) : state.flags.includes('evacuation-choice-pending') ? (
              <p>最后一天已经完成，等待你决定撤离路线。</p>
            ) : (
              <p>今日愿望正在生成；重新载入存档即可恢复。</p>
            )}
          </section>
          <section>
            <span className="section-kicker">CURRENT OBJECTIVE</span>
            <h2>当前目标</h2>
            <p>{state.phase === 'prep' ? `用七天建立足够的储备、加固与联系。${difficultyConfig.name}难度的日终是 ${formatClock(dayEndMinutes(state))}。` : state.phase === 'survival' ? `活过封锁第 ${difficultyConfig.survivalGoalDays} 夜。当前还需 ${Math.max(0, difficultyConfig.survivalGoalDays - state.survivalDay)} 天；普通撤离不依赖剧情物品。` : '把这轮留下的记忆带回下一次倒计时，并在标题页重选难度。'}</p>
            {state.phase === 'survival' && state.flags.includes('truth-window-open') && !state.flags.includes('truth-attempted') && (
              <dl className="objective-progress">
                <div><dt>证据</dt><dd>{truthEvidenceCount(state)} / 3</dd></div>
                <div><dt>盟友</dt><dd>{trustedNpcCount(state)} / 2</dd></div>
                <div><dt>有效广播</dt><dd>{state.broadcasts}</dd></div>
                <div><dt>情报</dt><dd>{state.intel}</dd></div>
              </dl>
            )}
          </section>
          <section>
            <span className="section-kicker">PEOPLE IN THE BUILDING</span>
            <h2>幸存者</h2>
            <div className="npc-list">
              {NPCS.map((npc) => {
                const unlocked = isNpcUnlocked(state, npc.id);
                const relation = state.relationships[npc.id] ?? 0;
                if (!unlocked) {
                  return (
                    <article key={npc.id} className="npc-locked">
                      <div><strong>未知呼号</strong><span>等待社区频段</span></div>
                      <em>未联络</em>
                      <p>继续收听有效广播，才能确认这名幸存者的身份与立场。</p>
                    </article>
                  );
                }
                return (
                  <article key={npc.id}>
                    <div><strong>{npc.name}</strong><span>{npc.role}</span></div>
                    <em className={relation < 0 ? 'negative' : relation >= 18 ? 'trusted' : ''}>{relation >= 18 ? '盟友' : relation > 0 ? `信任 ${relation}` : relation < 0 ? `戒备 ${relation}` : '陌生'}</em>
                    <p>{npc.stance}</p>
                  </article>
                );
              })}
            </div>
          </section>
          <section className="seed-readout"><span>SEED</span><code>{state.seed.toString(16).toUpperCase()}</code></section>
        </aside>
      </div>

      <div className="bottom-dock">
        <ActionPanel title={currentTitle} subtitle={actionSubtitle} choices={choices} shortcuts={settings.shortcuts} />
        <StatusDock state={state} />
      </div>

      {settings.tutorial && state.tutorialStep < TUTORIAL.length && state.phase !== 'ended' && (
        <aside className="tutorial-card" aria-live="polite">
          <span>新手提示 {state.tutorialStep + 1}/{TUTORIAL.length}</span>
          <h2>{TUTORIAL[state.tutorialStep].title}</h2>
          <p>{TUTORIAL[state.tutorialStep].body}</p>
          <div>
            <button type="button" onClick={() => onCommit({ ...state, tutorialStep: TUTORIAL.length })}>跳过</button>
            <button type="button" onClick={() => onCommit({ ...state, tutorialStep: state.tutorialStep + 1 })}>{state.tutorialStep === TUTORIAL.length - 1 ? '知道了' : '下一条'}</button>
          </div>
        </aside>
      )}

      {shop && (
        <Modal title={STORE_NAMES[shop]} onClose={() => setShop(null)} footer={<button className="primary-inline" type="button" onClick={() => setShop(null)}>结束采购</button>}>
          <p className="store-description">{STORE_DESCRIPTIONS[shop]}</p>
          <div className="store-balance"><span>现金 <b>¥{state.money}</b></span><span>到店耗时 1小时30分 · 选购不另计时</span></div>
          <div className="store-grid">
            {availableStoreItems(shop).map((item) => {
              const affordable = state.money >= item.price;
              const effects = formatItemEffects(item);
              const owned = inventoryCount(state.inventory, item.id);
              const easyPlan = state.difficulty === 'easy' ? item.easyPlan : undefined;
              const planComplete = Boolean(easyPlan && owned >= easyPlan.target);
              return (
                <article key={item.id}>
                  <div className="store-item-head"><strong>{item.name}</strong><b>¥{item.price}</b></div>
                  <div className="store-tags">
                    <span className={`category-pill category-${item.category}`}>{item.category}</span>
                    {easyPlan && <span className={`recommend-tag ${planComplete ? 'complete' : ''}`}>{planComplete ? '建议数量已备齐' : `简易${easyPlan.tier} · 建议×${easyPlan.target}`}</span>}
                  </div>
                  <p>{item.description}</p>
                  {effects.length > 0 && <div className="effect-list store-effects">{effects.map((effect) => <i key={effect}>{effect}</i>)}</div>}
                  <footer><span>{item.weight} kg{item.perishableDays ? ` · ${item.perishableDays} 天保质` : ''} · 已有 {owned}</span><button type="button" disabled={!affordable} onClick={() => onResult(purchaseItem(state, item.id))}>{affordable ? '购买' : '钱不够'}</button></footer>
                </article>
              );
            })}
          </div>
        </Modal>
      )}
    </main>
  );
}
