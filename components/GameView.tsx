'use client';

import { useState } from 'react';
import { DIFFICULTY_MAP } from '../game/data/difficulties.ts';
import { DAILY_REWARD_MAP, DAILY_WISH_MAP } from '../game/data/daily.ts';
import { ENTERTAINMENT, type EntertainmentId } from '../game/data/entertainment.ts';
import { EVENT_MAP } from '../game/data/events.ts';
import { formatItemEffects, STORE_DESCRIPTIONS, STORE_NAMES } from '../game/data/items.ts';
import { LOCATIONS, NPCS } from '../game/data/world.ts';
import { LOAN_MAP } from '../game/data/loans.ts';
import { DEEP_LOCATIONS, deepScene, deepTargetFlag } from '../game/data/deep-exploration.ts';
import { POWER_POLICIES } from '../game/data/power.ts';
import { activeContactLimit, survivalPressure } from '../game/data/pressure.ts';
import {
  availableStoreItems,
  endDay,
  eventOptionDisabledReason,
  performPrepAction,
  performSurvivalAction,
  prepWorkIncome,
  repairPreview,
  debtPaymentAmount,
  purchaseDisabledReason,
  purchaseItem,
  repayDebt,
  repayDebtDisabledReason,
  resolveCurrentEvent,
  useItem as consumeGameItem,
  visitStore,
  type PrepActionId,
} from '../game/engine/actions.ts';
import { cookingPreview, FURNITURE_ACTION_MINUTES, furnitureActionDisabledReason, performFurnitureAction, type FurnitureActionId } from '../game/engine/furniture.ts';
import { inventoryCount } from '../game/engine/inventory.ts';
import { isNpcUnlocked } from '../game/engine/npcs.ts';
import { debtRiskBonus } from '../game/engine/loan.ts';
import { bankDailyPoints, claimDailyReward, continueAfterMissedWish, dailyRewardCost, dailyRewardDescription, dailyWishProgress, dailyWishRewardPoints } from '../game/engine/daily.ts';
import { chooseEvacuation, truthEndingReady, truthEvidenceCount, trustedNpcCount } from '../game/engine/outcomes.ts';
import { dangerRisk } from '../game/engine/state.ts';
import { dayEndMinutes, formatClock, formatDuration, minutesRemaining, timeDisabledReason } from '../game/engine/time.ts';
import { prepSupplyMessage, shoppingCarryRemaining, storeStock } from '../game/engine/store.ts';
import { beginDeepExplore, deepOptionDisabledReason, deepStartDisabledReason, EXPLORATION_SKILL_LABELS, leaveDeepExplore, moveDeepExplore, resolveDeepTarget } from '../game/engine/deep-exploration.ts';
import { powerUpgradeSpec, setPowerPolicy } from '../game/engine/power.ts';
import { nextSiegeWave, siegeDamage, siegeMitigation, siegeWaveForDay } from '../game/engine/siege.ts';
import { dailyTradeOffers, executeTrade, tradeItemsText, tradeOfferDisabledReason, TRADE_MINUTES } from '../game/engine/trades.ts';
import { activeContactDisabledReason, contactCostText, contactOptions, contactsRemainingToday, npcAllianceFlag, performActiveContact } from '../game/engine/contacts.ts';
import { entertainmentDisabledReason, performEntertainment } from '../game/engine/entertainment.ts';
import type { GameState, SettingsState, StoreId } from '../game/types.ts';
import { ActionPanel, type ActionChoice } from './ActionPanel.tsx';
import { InventoryPanel } from './InventoryPanel.tsx';
import { Modal } from './Modal.tsx';
import { StatusBar, StatusDock } from './StatusBar.tsx';

type Mode = 'main' | 'shops' | 'explore' | 'craft' | 'entertainment' | 'contact' | 'trade' | 'power';
type EngineResult = { state: GameState; ok: boolean; message?: string };

const TUTORIAL = [
  { title: '状态就在右下', body: '健康、水分、饱腹、精神、体力和避难所状态固定在右下。低于 40 会影响危险判定。' },
  { title: '钟点决定一天', body: '每个行动会推进游戏内时钟，到达日终自动进入夜间结算。封锁后每经过两小时还会产生少量食水消耗；休息能恢复体力，但不再是免费循环。' },
  { title: '每件物资都标保存期', body: '易腐物会按入库批次显示“剩余 N 天”或“今天到期”，其他物资会标为长期保存；冰箱会逐批延长仍有效的保质期。' },
  { title: '精神每天都会下降', body: '封锁后的夜间压力每天都会降低精神，艰难后期下降更多。可在“家具、烹饪与制作 → 娱乐与放松”中写日记、阅读、摆纸牌或听音乐；同一活动每天只能获得一次收益。' },
  { title: '每天一个明确愿望', body: '系统每天直接给出一件当天能完成的事。达成后夜间领取奖励；没有完成也不会扣除任何状态或点数。' },
  { title: '结局由你决定', body: '证据发送成功不会自动覆盖普通撤离。最后一天会明确让你选择离城路线，结局文案也会回应关键经历。' },
  { title: '越早采购越稳妥', body: '第一天商店货最全，此后会逐日限购和缺货。每次出门还有随身负重上限；第七天闯商店可能受伤，也可能在无人收银时带回一包物资。' },
  { title: '所有地点都能逐区深入', body: '封锁后六处地点都有各自的内部区域、现场目标和多种处理方法。工具、技能、情报与已发现路线会解锁不同解法；随时可以返回入口撤离，系统会预留返程时间。' },
  { title: '人物可以主动培养', body: '广播逐个建立人物联络后，可主动选择咨询或提供物资。信任达到门槛即可邀请结盟，让对方的职业能力持续影响诊疗、探索、维修或围攻。' },
  { title: '危险不是纯碰运气', body: '选项会先显示受险概率。系统再生成 1—100 的种子随机值：大于风险线就安全，低于风险线会受损，低于风险线一半会是严重后果。状态、装备、情报、难度和债务都会改变风险线。' },
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
  const [shop, setShop] = useState<StoreId | null>(() => state.shoppingTrip?.store ?? null);
  const [drawer, setDrawer] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const event = state.currentEventId ? EVENT_MAP[state.currentEventId] : undefined;
  const difficultyConfig = DIFFICULTY_MAP[state.difficulty];
  const activeWish = state.dailyPlan ? DAILY_WISH_MAP[state.dailyPlan.wishId] : undefined;
  const settlementWish = state.dailySettlement ? DAILY_WISH_MAP[state.dailySettlement.wishId] : undefined;
  const expeditionLocation = state.expedition ? DEEP_LOCATIONS[state.expedition.locationId] : undefined;
  const expeditionScene = state.expedition ? deepScene(state.expedition.locationId, state.expedition.sceneId) : undefined;
  const selectedTarget = expeditionScene?.targets.find((target) => target.id === selectedTargetId);
  const pressure = survivalPressure(state.difficulty, Math.max(1, state.survivalDay));

  const run = (result: EngineResult) => {
    const ok = onResult(result);
    if (ok) {
      setMode('main');
      setSelectedTargetId(null);
      setSelectedContactId(null);
    }
    return ok;
  };

  const closeShop = () => {
    setShop(null);
    if (state.shoppingTrip) onCommit({ ...state, shoppingTrip: undefined });
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
      return [...state.dailySettlement.rewardChoices.map((rewardId) => {
        const reward = DAILY_REWARD_MAP[rewardId];
        const cost = dailyRewardCost(state, reward.id);
        return {
          id: reward.id,
          label: reward.name,
          hint: `${cost} 愿望点 · ${dailyRewardDescription(state, reward.id)}`,
          disabledReason: state.dailyPoints < cost ? `愿望点不足（需要 ${cost}）` : undefined,
          onSelect: () => run(claimDailyReward(state, reward.id)),
        };
      }), {
        id: 'bank-daily-points',
        label: '暂不领取，保留愿望点',
        hint: '不获得即时恢复或物资；所有点数留到后续日结',
        onSelect: () => run(bankDailyPoints(state)),
      }];
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
        {
          id: 'remain-behind',
          label: '放弃车位，留守街区',
          hint: '结束本轮并进入留守者结局；人物关系和社区准备会写入尾声',
          onSelect: () => run(chooseEvacuation(state, 'remain')),
        },
      ];
    }
    if (state.expedition && expeditionLocation && expeditionScene) {
      if (selectedTarget && !state.flags.includes(deepTargetFlag(expeditionLocation.id, selectedTarget.id))) {
        return [
          ...selectedTarget.options.map((option) => ({
            id: `${selectedTarget.id}-${option.id}`,
            label: option.label,
            hint: option.hint,
            disabledReason: deepOptionDisabledReason(state, selectedTarget.id, option.id),
            danger: option.danger ? `${dangerRisk(state, option.danger).risk}% 受险` : undefined,
            onSelect: () => run(resolveDeepTarget(state, selectedTarget.id, option.id)),
          })),
          { id: 'target-back', label: '先不处理', hint: '返回当前区域，不耗时也没有惩罚', onSelect: () => setSelectedTargetId(null) },
        ];
      }
      const targets: ActionChoice[] = expeditionScene.targets.map((target) => {
        const resolved = state.flags.includes(deepTargetFlag(expeditionLocation.id, target.id));
        return {
          id: `inspect-${target.id}`,
          label: resolved ? `已处理 · ${target.name}` : `查看 · ${target.name}`,
          hint: resolved ? '这里已经搜查完毕，所得物资不会重复生成' : target.observation,
          disabledReason: resolved ? '已经处理完毕' : undefined,
          onSelect: () => setSelectedTargetId(target.id),
        };
      });
      const moves: ActionChoice[] = expeditionScene.connections.map((sceneId) => {
        const destination = deepScene(expeditionLocation.id, sceneId)!;
        return { id: `move-${sceneId}`, label: `前往 · ${destination.name}`, hint: '10分钟 · 体力 -1', onSelect: () => run(moveDeepExplore(state, sceneId)) };
      });
      return [...targets, ...moves, { id: 'leave-expedition', label: '结束探索并返回避难所', hint: `${formatDuration(expeditionLocation.returnMinutes)} · 体力 -3 · 结算本次带回物资`, onSelect: () => run(leaveDeepExplore(state)) }];
    }
    if (event) {
      return event.options.map((option, index) => ({
        id: `${event.id}-${index}`,
        label: option.label,
        hint: option.hint,
        disabledReason: eventOptionDisabledReason(state, index),
        danger: option.danger ? `${dangerRisk(state, option.danger).risk}% 受险` : undefined,
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
          label: state.prepDay === 7 ? `高风险 · ${label}` : label,
          hint: state.prepDay === 7 ? `2小时30分 · ${hint} · 可能受伤，也可能免费带回残余物资` : `1小时30分 · ${hint}`,
          danger: state.prepDay === 7 ? `${state.difficulty === 'easy' ? 10 : state.difficulty === 'hard' ? 26 : 18}% 受伤` : undefined,
          disabledReason: timedReason(state, state.prepDay === 7 ? 150 : 120)
            ?? (state.prepDay === 7
              ? state.flags.includes(`risky-shopping:${state.prepDay}`) ? '最后一天已经冒险采购过一次' : null
              : state.flags.includes(`visited-store:${state.prepDay}:${id}`) ? '今天已经去过这家店' : null),
          onSelect: () => {
            const result = visitStore(state, id);
            if (onResult(result)) {
              if (state.prepDay === 7) setMode('main');
              else setShop(id);
            }
          },
        }));
        return [...storeChoices, { id: 'back', label: '返回准备清单', hint: '不耗时', onSelect: () => setMode('main') }];
      }
      if (mode === 'power') {
        const upgrade = powerUpgradeSpec(state);
        return [
          ...(upgrade ? [{
            id: 'power-upgrade',
            label: `${upgrade.name} · 升至 ${upgrade.level} 级`,
            hint: `${formatDuration(upgrade.minutes)} · ¥${upgrade.money} · 备用电力 +${upgrade.power}`,
            disabledReason: timedReason(state, upgrade.minutes) ?? (state.money < upgrade.money ? `金钱不足（需要 ¥${upgrade.money}）` : null),
            onSelect: () => run(performPrepAction(state, 'power')),
          }] : [{ id: 'power-max', label: '供电改造已满级', hint: '冰箱、照明与厨房电器已经分路管理', disabledReason: '本轮无法继续升级', onSelect: () => undefined }]),
          {
            id: 'power-drill', label: '进行全屋停电演练', hint: '1小时30分 · 情报 +1 · 回收电力 +2 · 提前发现用电冲突',
            disabledReason: timedReason(state, 90) ?? (state.shelter.generator < 1 ? '需要供电改造等级 1' : state.flags.includes('power-audited') ? '本轮已经演练过' : null),
            onSelect: () => run(performPrepAction(state, 'drill')),
          },
          ...POWER_POLICIES.map((policy) => {
            const policyNights = policy.expectedPower === 0 ? null : Math.floor(state.shelter.power / policy.expectedPower);
            return {
              id: `policy-${policy.id}`, label: `${state.powerPolicy === policy.id ? '当前 · ' : ''}${policy.name}`,
              hint: `预计每晚 ${policy.expectedPower} 电 · ${policy.description}${policyNights === null ? ' 当前可无限期节电。' : ` 按当前电量约 ${policyNights} 夜。`}`,
              disabledReason: state.powerPolicy === policy.id ? '正在采用' : undefined,
              onSelect: () => run(setPowerPolicy(state, policy.id)),
            };
          }),
          { id: 'back', label: '返回准备清单', hint: '不耗时', onSelect: () => setMode('main') },
        ];
      }
      const prep = (id: PrepActionId, label: string, hint: string, minutes: number, extra?: string | null): ActionChoice => ({
        id,
        label,
        hint: `${formatDuration(minutes)} · ${hint}`,
        disabledReason: timedReason(state, minutes) ?? extra,
        onSelect: () => run(performPrepAction(state, id)),
      });
      return [
        prep('work', '临时加班', `金钱 +¥${prepWorkIncome(state)} · 体力 -18`, 240, state.flags.includes(`worked:${state.prepDay}`) ? '今天已经工作过' : null),
        {
          id: 'shops',
          label: state.prepDay === 7 ? '封锁前最后采购' : '前往商店采购',
          hint: state.prepDay === 7 ? '2小时30分 · 街面已失控：可能受伤，也可能免费带回残余物资' : `1小时30分 · ${prepSupplyMessage(state.prepDay)}`,
          danger: state.prepDay === 7 ? `${state.difficulty === 'easy' ? 10 : state.difficulty === 'hard' ? 26 : 18}% 受伤` : undefined,
          disabledReason: timedReason(state, state.prepDay === 7 ? 150 : 120) ?? (state.prepDay === 7 && state.flags.includes(`risky-shopping:${state.prepDay}`) ? '最后一天已经冒险采购过一次' : null),
          onSelect: () => setMode('shops'),
        },
        prep('reinforce', '加固门窗', '¥70 · 完整度 +15', 180, state.money < 70 ? '金钱不足（需要 ¥70）' : null),
        prep('water', '改造储水', '¥90 · 储水 +18', 180, state.money < 90 ? '金钱不足（需要 ¥90）' : null),
        { id: 'power', label: '规划备用供电', hint: `改造、停电演练与夜间负载 · 当前 ${state.shelter.power} 电`, onSelect: () => setMode('power') },
        prep('investigate', '调查灾难情报', '情报 +1 · 降低探索危险', 120),
        prep('contact', '给邻居逐户留言', '灾后首次建立广播联络时获得初始信任', 90),
        prep('rest', '休息片刻', '体力 +25 · 精神 +5', 120),
        { id: 'end', label: '就寝并进入下一天', hint: `现在 ${formatClock(state.clockMinutes)} · 推进至 ${formatClock(dayEndMinutes(state))} 后结算`, onSelect: () => run(endDay(state)) },
      ];
    }

    if (mode === 'explore') {
      const locationChoices: ActionChoice[] = LOCATIONS.map((location) => {
        const deepLocation = DEEP_LOCATIONS[location.id];
        const weatherPenalty = state.weather === '酸雨' ? 8 : state.weather === '暴雨' ? 6 : state.weather === '大雾' ? 4 : 0;
        const approachRisk = deepLocation.approachRisk + Math.min(12, Math.max(0, state.survivalDay - 1)) + weatherPenalty;
        return {
          id: location.id,
          label: `深入探索 · ${location.name}`,
          hint: `${location.district} · 去程 ${formatDuration(deepLocation.travelMinutes)} / 回程 ${formatDuration(deepLocation.returnMinutes)} · ${deepLocation.scenes.length} 个内部区域 · ${state.visited[location.id] ? `已撤离 ${state.visited[location.id]} 次` : '尚未进入'}`,
          danger: `${dangerRisk(state, approachRisk).risk}% 路途受险`,
          disabledReason: deepStartDisabledReason(state, location.id),
          onSelect: () => run(beginDeepExplore(state, location.id)),
        };
      });
      return [...locationChoices, { id: 'back', label: '返回避难所行动', hint: '不耗时', onSelect: () => setMode('main') }];
    }
    if (mode === 'craft') {
      const furnitureChoice = (id: FurnitureActionId, label: string): ActionChoice => {
        const preview = cookingPreview(state, id);
        return {
          id,
          label,
          hint: `${formatDuration(FURNITURE_ACTION_MINUTES[id])} · 当前可做 ${preview.recipes} 种 · 技能 ${preview.skill} 级 · 成功率 ${preview.chance}% · 优先使用储水`,
          disabledReason: furnitureActionDisabledReason(state, id),
          onSelect: () => run(performFurnitureAction(state, id)),
        };
      };
      return [
        furnitureChoice('gas-stove', '燃气炉 · 随机料理'),
        furnitureChoice('microwave', '微波炉 · 随机料理'),
        furnitureChoice('electric-hotpot', '电火锅 · 随机料理'),
        { id: 'entertainment', label: '娱乐与放松', hint: `今夜精神将自然 -${pressure.moraleDrain} · 安排日记、阅读、纸牌或音乐`, onSelect: () => setMode('entertainment') },
        { id: 'drink-storage', label: '从储水装置取水', hint: '20分钟 · 储水 -4 · 水分 +26', disabledReason: timedReason(state, 20) ?? (state.shelter.water < 4 ? '储水不足 4' : null), onSelect: () => run(performSurvivalAction(state, 'drink-storage')) },
        { id: 'barricade', label: '木板加固', hint: '2小时 · 木板 -1 · 完整度 +20', disabledReason: timedReason(state, 120) ?? (inventoryCount(state.inventory, 'wood-board') < 1 ? '缺少木板 ×1' : null), onSelect: () => run(performSurvivalAction(state, 'barricade')) },
        { id: 'plate', label: '钢板封固', hint: '2小时30分 · 薄钢板 -1 · 完整度 +32 · 加固 +2', disabledReason: timedReason(state, 150) ?? (inventoryCount(state.inventory, 'metal-sheet') < 1 ? '缺少薄钢板 ×1' : inventoryCount(state.inventory, 'toolkit') < 1 ? '需要家用工具箱' : null), onSelect: () => run(performSurvivalAction(state, 'plate')) },
        { id: 'purify', label: '处理雨水', hint: '1小时30分 · 净水片、滤布、储水 6 → 瓶装水 2', disabledReason: timedReason(state, 90) ?? (inventoryCount(state.inventory, 'purifier-tablet') < 1 ? '缺少净水片' : inventoryCount(state.inventory, 'filter-cloth') < 1 ? '缺少活性炭滤布' : state.shelter.water < 6 ? '储水不足 6' : null), onSelect: () => run(performSurvivalAction(state, 'purify')) },
        { id: 'back', label: '返回避难所行动', hint: '不耗时', onSelect: () => setMode('main') },
      ];
    }
    if (mode === 'entertainment') {
      return [
        ...ENTERTAINMENT.map((activity) => ({
          id: `entertainment-${activity.id}`,
          label: activity.name,
          hint: `${formatDuration(activity.minutes)} · 精神 +${activity.morale}${activity.id === 'music' ? ' · 电力 -1（缺电时电池 -1）' : activity.requiredItem ? ` · 需要${activity.requiredItem === 'paperback' ? '旧版悬疑小说' : '缺角扑克牌'}` : ' · 不消耗物资'}`,
          disabledReason: entertainmentDisabledReason(state, activity.id as EntertainmentId),
          onSelect: () => run(performEntertainment(state, activity.id as EntertainmentId)),
        })),
        { id: 'back', label: '返回家具与制作', hint: '不耗时', onSelect: () => setMode('craft') },
      ];
    }
    if (mode === 'trade') {
      const offers = dailyTradeOffers(state);
      return [
        ...(!offers.length ? [{ id: 'trade-locked', label: '交易频道尚未建立', hint: '先收听广播，与至少一名幸存者建立联络', disabledReason: '当前没有可联系的交易对象', onSelect: () => undefined }] : offers.map((offer) => ({
          id: `trade-${offer.id}`,
          label: `${NPCS.find((npc) => npc.id === offer.npcId)?.name ?? '幸存者'} · ${offer.label}`,
          hint: `${formatDuration(TRADE_MINUTES)} · 付出 ${tradeItemsText(offer.give)} → 获得 ${tradeItemsText(offer.receive)}`,
          disabledReason: tradeOfferDisabledReason(state, offer.id),
          onSelect: () => run(executeTrade(state, offer.id)),
        }))),
        ...(state.debt ? [
          { id: 'repay-minimum', label: `偿还最低额 ¥${debtPaymentAmount(state, 'minimum')}`, hint: `30分钟 · 当前债务 ¥${state.debt.balance}`, disabledReason: repayDebtDisabledReason(state, 'minimum'), onSelect: () => run(repayDebt(state, 'minimum')) },
          { id: 'repay-all', label: `一次结清 ¥${debtPaymentAmount(state, 'all')}`, hint: '30分钟 · 结清后立即移除债务危险加成', disabledReason: repayDebtDisabledReason(state, 'all'), onSelect: () => run(repayDebt(state, 'all')) },
        ] : []),
        { id: 'back', label: '返回联络面板', hint: '不耗时', onSelect: () => setMode('contact') },
      ];
    }
    if (mode === 'contact') {
      const unlocked = NPCS.filter((npc) => isNpcUnlocked(state, npc.id));
      const selectedNpc = selectedContactId ? NPCS.find((npc) => npc.id === selectedContactId) : undefined;
      if (selectedNpc) {
        const allied = state.flags.includes(npcAllianceFlag(selectedNpc.id));
        return [
          ...contactOptions(selectedNpc.id).map((option) => ({
            id: `contact-${selectedNpc.id}-${option.id}`,
            label: option.label,
            hint: `${contactCostText(state)} · ${option.hint}`,
            disabledReason: activeContactDisabledReason(state, selectedNpc.id, option.id),
            onSelect: () => run(performActiveContact(state, selectedNpc.id, option.id)),
          })),
          {
            id: `contact-${selectedNpc.id}-alliance`,
            label: allied ? `已结盟 · ${selectedNpc.talentName}` : `邀请结盟 · ${selectedNpc.talentName}`,
            hint: `${contactCostText(state)} · 需要信任 ${selectedNpc.allianceThreshold} · ${selectedNpc.talentDescription}`,
            disabledReason: activeContactDisabledReason(state, selectedNpc.id, 'alliance'),
            onSelect: () => run(performActiveContact(state, selectedNpc.id, 'alliance')),
          },
          { id: 'back-contacts', label: '选择其他联络人', hint: '不耗时', onSelect: () => setSelectedContactId(null) },
        ];
      }
      return [
        ...(!unlocked.length ? [{ id: 'contact-locked', label: '尚未建立人物联络', hint: '先收听广播，每次有效收听会解锁一名人物', disabledReason: '当前没有可主动联系的人', onSelect: () => undefined }] : unlocked.map((npc) => ({
          id: `contact-${npc.id}`,
          label: `${state.flags.includes(npcAllianceFlag(npc.id)) ? '盟友' : '主动联络'} · ${npc.name}`,
          hint: `${npc.role} · 信任 ${state.relationships[npc.id] ?? 0}/${npc.allianceThreshold} · ${npc.talentName}：${npc.talentDescription}`,
          onSelect: () => setSelectedContactId(npc.id),
        }))),
        { id: 'trade-board', label: state.debt ? '今日报价与偿还债务' : '查看幸存者今日报价', hint: state.debt ? `随机物资报价 · 当前债务 ¥${state.debt.balance}` : '报价按日期随机刷新，与主动联络分开计算', onSelect: () => setMode('trade') },
        { id: 'back', label: '返回避难所行动', hint: '不耗时', onSelect: () => setMode('main') },
      ];
    }
    if (mode === 'power') {
      return [
        { id: 'generator', label: '启动燃油发电机', hint: '30分钟 · 需要发电机本体与供电改造 · 燃料 -3 · 电力 +5', disabledReason: timedReason(state, 30) ?? (state.shelter.generator < 1 ? '灾前未完成一级供电改造' : inventoryCount(state.inventory, 'fuel-generator') < 1 ? '缺少发电机本体（灾前五金店购买）' : state.shelter.fuel < 3 ? '燃料不足 3' : null), onSelect: () => run(performSurvivalAction(state, 'generator')) },
        ...POWER_POLICIES.map((policy) => {
          const policyNights = policy.expectedPower === 0 ? null : Math.floor(state.shelter.power / policy.expectedPower);
          return {
            id: `policy-${policy.id}`, label: `${state.powerPolicy === policy.id ? '当前 · ' : ''}${policy.name}`,
            hint: `预计每晚 ${policy.expectedPower} 电 · ${policy.description}${policyNights === null ? ' 当前策略不消耗电。' : ` 当前电量约可维持 ${policyNights} 夜。`}`,
            disabledReason: state.powerPolicy === policy.id ? '正在采用' : undefined,
            onSelect: () => run(setPowerPolicy(state, policy.id)),
          };
        }),
        { id: 'back', label: '返回避难所行动', hint: '不耗时', onSelect: () => setMode('main') },
      ];
    }
    const radioMinutes = state.shelter.power >= 2 || inventoryCount(state.inventory, 'batteries') > 0 ? 60 : 120;
    const truthDay = difficultyConfig.truthDecisionDay;
    const repair = repairPreview(state);
    return [
      { id: 'rest', label: '休息两小时', hint: '2小时 · 体力 +32 · 精神 +4', disabledReason: timedReason(state, 120), onSelect: () => run(performSurvivalAction(state, 'rest')) },
      { id: 'repair', label: '修缮避难所', hint: repair.material ? `2小时 · 胶带 -1 · 完整度 +${repair.amount} · 体力 -${repair.stamina}` : `2小时 · 今日一次临时支撑 · 完整度 +${repair.amount} · 体力 -${repair.stamina}`, disabledReason: timedReason(state, 120) ?? repair.disabledReason, onSelect: () => run(performSurvivalAction(state, 'repair')) },
      { id: 'craft', label: '家具、烹饪与制作', hint: '使用自带厨房家具，或进行净水和加固', disabledReason: minutesRemaining(state) < 20 ? '今天已没有制作时间' : null, onSelect: () => setMode('craft') },
      { id: 'radio', label: '收听广播', hint: `${formatDuration(radioMinutes)} · 优先耗电 2 或电池 1`, disabledReason: timedReason(state, radioMinutes) ?? (inventoryCount(state.inventory, 'radio') < 1 ? '缺少短波收音机' : null), onSelect: () => run(performSurvivalAction(state, 'radio')) },
      { id: 'contact', label: state.debt ? '联络、交易与偿还债务' : '主动联络与幸存者交易', hint: '主动选择已解锁人物，培养信任、提供物资或邀请结盟', onSelect: () => { setSelectedContactId(null); setMode('contact'); } },
      { id: 'explore', label: '外出探索', hint: `选择 6 个细化地点 · ${state.difficulty === 'hard' ? '普通战利品约为标准的 65%，剧情物品不减' : '危险与收益受状态和路线影响'}`, disabledReason: timedReason(state, 120), onSelect: () => setMode('explore') },
      { id: 'power', label: '供电与夜间负载', hint: `当前 ${state.shelter.power} 电 · 调整保鲜、照明或节电策略`, onSelect: () => setMode('power') },
      ...(state.survivalDay >= truthDay && state.flags.includes('truth-window-open') && !state.flags.includes('truth-attempted') ? [{ id: 'truth', label: '搭建外联中继', hint: '3小时 · 每轮只有一次发送窗口；失败后仍可普通撤离', disabledReason: truthEndingReady(state) ? timedReason(state, 180) : `需要证据 3（${truthEvidenceCount(state)}）、盟友 2（${trustedNpcCount(state)}）与已解码广播`, danger: `${dangerRisk(state, 46).risk}% 受险`, onSelect: () => run(performSurvivalAction(state, 'truth')) }] : []),
      { id: 'end', label: '就寝并进行夜间结算', hint: `现在 ${formatClock(state.clockMinutes)} · 尚余 ${formatDuration(minutesRemaining(state))}`, onSelect: () => run(endDay(state)) },
    ];
  })();

  const currentTitle = state.phase === 'ended'
    ? '本轮记录'
    : state.dailySettlement
      ? state.dailySettlement.wishAchieved ? '从今日结算中挑选一项奖励' : '确认今日愿望结果'
      : state.flags.includes('evacuation-choice-pending')
        ? '选择这一次如何离开'
        : state.expedition
          ? selectedTarget ? `处理 · ${selectedTarget.name}` : `探索 · ${expeditionScene?.name ?? '未知区域'}`
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
                        : mode === 'entertainment'
                          ? '娱乐与精神恢复'
                        : mode === 'power'
                          ? '备用供电与夜间负载'
                          : mode === 'contact'
                            ? selectedContactId ? `主动联络 · ${NPCS.find((npc) => npc.id === selectedContactId)?.name ?? '幸存者'}` : '幸存者联络与结盟'
                            : '今日幸存者报价';
  const actionSubtitle = state.dailySettlement
    ? state.dailySettlement.wishAchieved
      ? `愿望点余额 ${state.dailyPoints} · 选择一项今日奖励`
      : `今日奖励 +0 · 未完成没有惩罚`
    : state.phase === 'ended'
      ? '本轮状态已经锁定并保存；返回标题页后可查看记忆或开始下一轮'
    : state.flags.includes('evacuation-choice-pending')
      ? '结局由你选择，不会因满足隐藏条件自动覆盖普通撤离'
      : state.expedition
        ? selectedTarget ? '不同解法会消耗不同的时间与体力，并产生不同收获' : `已发现 ${state.expedition.discoveredScenes.length}/${expeditionLocation?.scenes.length ?? 0} 个区域 · 已为返程预留时间`
      : event
            ? '选择将耗时 30 分钟并写入日志'
              : mode === 'trade'
              ? `封锁第 ${state.survivalDay} 天 · 报价明日刷新；${state.difficulty === 'easy' ? '可逐笔交换' : '今日最多成交一笔'}`
              : mode === 'contact'
                ? `今日还可主动联络 ${contactsRemainingToday(state)}/${activeContactLimit(state.difficulty)} 次；艰难难度每次优先消耗 2 点电力`
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
              {state.feedback.slice(-6).map((item) => <span key={item.id} className={item.label === '时间' ? 'time' : item.delta < 0 || (item.label === '饮食厌倦' && item.delta > 0) ? 'negative' : 'positive'}>{item.label} {item.label === '时间' ? `+${formatDuration(item.delta)}` : `${item.delta > 0 ? '+' : ''}${item.delta}`}<small>{item.reason}</small></span>)}
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
          ) : state.expedition && expeditionLocation && expeditionScene ? (
            <article className="current-story expedition-story" tabIndex={-1}>
              <span className="story-time">{expeditionLocation.name.toUpperCase()} / {formatClock(state.clockMinutes)}</span>
              <h2>{selectedTarget?.name ?? expeditionScene.name}</h2>
              <p>{selectedTarget?.observation ?? expeditionScene.text}</p>
              <span className="chain-tag">已发现 {state.expedition.discoveredScenes.length}/{expeditionLocation.scenes.length} 区域 · 本次所得 {state.expedition.gathered.length} 类</span>
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
                : siegeWaveForDay(state) ? `${siegeWaveForDay(state)!.warning}今晚将承受 ${siegeWaveForDay(state)!.pressure} 点冲击；当前加固预计吸收 ${Math.min(siegeWaveForDay(state)!.pressure, siegeMitigation(state))} 点。` : state.survivalDay === 8 ? '尸潮已经抵达主路。今天的任何噪声、加固和盟友都会影响门能撑多久。' : '行动会推进游戏内时钟。抵达日终后自动结算饱腹、水分、天气、冰箱、供电与伤病，也可以提前就寝。'}</p>
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
            {state.phase === 'ended' ? (
              <p>本轮愿望与资源结算已经结束，终局状态不会再发生变化。</p>
            ) : state.dailySettlement ? (
              <p>{state.dailySettlement.wishAchieved ? '今天的愿望已经达成，请在下方领取一项奖励。' : '今天的愿望没有完成；没有惩罚，确认后继续。'}</p>
            ) : activeWish ? (
              <>
                <p><strong>{activeWish.name}</strong><br />{activeWish.description}</p>
                <dl className="daily-progress">
                  <div><dt>进度</dt><dd>{dailyWishProgress(state)}</dd></div>
                  <div><dt>达成奖励</dt><dd>+{dailyWishRewardPoints(state)} 愿望点</dd></div>
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
          {state.debt && (
            <section className="debt-panel">
              <span className="section-kicker">OUTSTANDING DEBT</span>
              <h2>未结债务 · ¥{state.debt.balance}</h2>
              <p>{LOAN_MAP[state.debt.tier].name}，封锁第 {state.debt.dueSurvivalDay} 天到期。当前危险判定 +{debtRiskBonus(state)}；已逾期催收 {state.debt.missedCollections} 次。</p>
              <dl className="daily-progress"><div><dt>最低还款</dt><dd>¥{Math.min(state.debt.balance, state.debt.minimumPayment)}</dd></div><div><dt>累计已还</dt><dd>¥{state.debt.totalRepaid}</dd></div></dl>
            </section>
          )}
          {state.phase === 'survival' && state.difficulty === 'hard' && nextSiegeWave(state) && (() => {
            const wave = nextSiegeWave(state)!;
            const mitigation = siegeMitigation(state);
            return (
              <section className="siege-panel">
                <span className="section-kicker">HARD MODE SIEGE</span>
                <h2>{wave.day === state.survivalDay ? `今夜 · ${wave.name}` : `下一波 · 第 ${wave.day} 夜`}</h2>
                <p>{wave.warning}{wave.day >= 8 ? '第 8 夜起围攻每天发生且持续增强；受压加固会磨损，必须安排材料和维修时间。' : '波次固定发生，方便提前安排材料和维修时间。'}</p>
                <dl className="daily-progress">
                  <div><dt>冲击</dt><dd>{wave.pressure}</dd></div>
                  <div><dt>加固吸收</dt><dd>{Math.min(wave.pressure, mitigation)}</dd></div>
                  <div><dt>预计损伤</dt><dd>{siegeDamage(state, wave)}</dd></div>
                  {wave.reinforcementWear > 0 && <div><dt>加固磨损</dt><dd>−{Math.min(state.shelter.reinforcement, wave.reinforcementWear)}</dd></div>}
                </dl>
              </section>
            );
          })()}
          {state.phase === 'survival' && state.difficulty === 'hard' && (
            <section className="siege-panel">
              <span className="section-kicker">LATE-GAME ATTRITION</span>
              <h2>{pressure.name}</h2>
              <p>{pressure.description}这些数值由同一套压力表驱动，日志与夜间结算会逐项记录。</p>
              <dl className="daily-progress">
                <div><dt>今夜饱腹</dt><dd>−{pressure.foodDrain}</dd></div>
                <div><dt>今夜水分</dt><dd>−{pressure.waterDrain}</dd></div>
                <div><dt>睡眠体力</dt><dd>+{pressure.staminaRecovery}</dd></div>
                <div><dt>今夜精神</dt><dd>−{pressure.moraleDrain}</dd></div>
                <div><dt>每行动 2 小时</dt><dd>饱腹 −{pressure.activityFoodPerTwoHours} / 水分 −{pressure.activityWaterPerTwoHours}</dd></div>
              </dl>
            </section>
          )}
          {state.phase === 'survival' && (
            <section className="risk-guide">
              <span className="section-kicker">DANGER CHECK</span>
              <h2>危险判定怎么读</h2>
              <p>标签中的百分比就是当前受险概率。行动时生成 1—100 的种子随机值：<strong>大于风险线＝安全</strong>；落在风险线以内＝轻微后果；低于风险线一半＝严重后果。日志会列出基础风险及每个加减因素。</p>
            </section>
          )}
          <section className="exploration-skills">
            <span className="section-kicker">FIELD SKILLS</span>
            <h2>现场技能</h2>
            <dl className="daily-progress">
              {(Object.entries(state.explorationSkills) as Array<[keyof typeof state.explorationSkills, { level: number; xp: number }]>).map(([skill, progress]) => (
                <div key={skill}><dt>{EXPLORATION_SKILL_LABELS[skill]}</dt><dd>{progress.level}级 · {progress.xp} XP</dd></div>
              ))}
            </dl>
            <p>每 3 点经验提升 1 级，最高 5 级。技能、工具与情报会共同解锁安静或高收益的处理方式。</p>
          </section>
          {state.isolationNights > 0 && (
            <section className="isolation-panel">
              <span className="section-kicker">ISOLATION WARNING</span>
              <h2>连续孤立 {state.isolationNights} / 3 夜</h2>
              <p>精神低于危险线且没有任何有效广播联络。收听广播建立联系人，或先通过休息与物资把精神恢复到 20 以上，即可中断累计。</p>
            </section>
          )}
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
                const allied = state.flags.includes(npcAllianceFlag(npc.id));
                return (
                  <article key={npc.id}>
                    <div><strong>{npc.name}</strong><span>{npc.role}</span></div>
                    <em className={relation < 0 ? 'negative' : allied || relation >= npc.allianceThreshold ? 'trusted' : ''}>{allied ? '已结盟' : relation >= npc.allianceThreshold ? `可邀请结盟 · ${relation}` : relation > 0 ? `信任 ${relation}/${npc.allianceThreshold}` : relation < 0 ? `戒备 ${relation}` : '陌生'}</em>
                    <p>{npc.stance}<br />职业能力：{npc.talentName}——{npc.talentDescription}</p>
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
        <Modal title={STORE_NAMES[shop]} onClose={closeShop} footer={<button className="primary-inline" type="button" onClick={closeShop}>结束采购</button>}>
          <p className="store-description">{STORE_DESCRIPTIONS[shop]} {prepSupplyMessage(state.prepDay)}</p>
          <div className="store-balance"><span>现金 <b>¥{state.money}</b></span><span>随身包剩余 <b>{shoppingCarryRemaining(state).toFixed(1)} kg</b> · 选购不另计时</span></div>
          <div className="store-grid">
            {availableStoreItems(shop).map((item) => {
              const stock = storeStock(state, item);
              const disabledReason = purchaseDisabledReason(state, item.id);
              const effects = formatItemEffects(item);
              const owned = inventoryCount(state.inventory, item.id);
              const easyPlan = state.difficulty === 'easy' ? item.easyPlan : undefined;
              const planComplete = Boolean(easyPlan && owned >= easyPlan.target);
              return (
                <article key={item.id} title={`${item.name}：${item.description}`}>
                  <div className="store-item-head"><strong>{item.name}</strong><b>¥{item.price}</b></div>
                  <div className="store-tags">
                    <span className={`category-pill category-${item.category}`}>{item.category}</span>
                    <span className={`stock-tag ${stock.remaining === 0 ? 'sold-out' : stock.remaining === 1 ? 'last-one' : ''}`}>{stock.label}</span>
                    {easyPlan && <span className={`recommend-tag ${planComplete ? 'complete' : ''}`}>{planComplete ? '建议数量已备齐' : `简易${easyPlan.tier} · 建议×${easyPlan.target}`}</span>}
                  </div>
                  <p>{item.description}</p>
                  {effects.length > 0 && <div className="effect-list store-effects">{effects.map((effect) => <i key={effect}>{effect}</i>)}</div>}
                  <footer><span>{item.weight} kg{item.perishableDays ? ` · ${item.perishableDays} 天保质` : ''} · 已有 {owned}</span><button type="button" disabled={Boolean(disabledReason)} onClick={() => onResult(purchaseItem(state, item.id))}>{disabledReason ?? '购买'}</button></footer>
                </article>
              );
            })}
          </div>
        </Modal>
      )}
    </main>
  );
}
