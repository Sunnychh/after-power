import type { DailyRewardId, DailyWishId, Phase } from '../types.ts';

export interface DailyWishDefinition {
  id: DailyWishId;
  phase: 'prep' | 'survival';
  name: string;
  description: string;
  rewardPoints: number;
  matchingActions: string[];
}

export interface DailyRewardDefinition {
  id: DailyRewardId;
  name: string;
  description: string;
  cost: number;
}

export const DAILY_WISHES: DailyWishDefinition[] = [
  {
    id: 'prep-income',
    phase: 'prep',
    name: '今天多攒一笔钱',
    description: '完成一次临时工作。钱会进账，体力也会明显下降。',
    rewardPoints: 2,
    matchingActions: ['prep:work'],
  },
  {
    id: 'prep-home',
    phase: 'prep',
    name: '让屋子更能撑',
    description: '完成门窗加固、储水改造、备用供电或停电演练中的任意一项。',
    rewardPoints: 2,
    matchingActions: ['prep:reinforce', 'prep:water', 'prep:power', 'prep:drill'],
  },
  {
    id: 'prep-contact',
    phase: 'prep',
    name: '别一个人准备',
    description: '联系一名邻居，或花时间核对一条灾难情报。',
    rewardPoints: 2,
    matchingActions: ['prep:contact', 'prep:investigate'],
  },
  {
    id: 'survival-explore',
    phase: 'survival',
    name: '从门外带回消息',
    description: '完成一次地点探索；不要求毫发无伤，但必须回来。',
    rewardPoints: 2,
    matchingActions: ['survival:explore'],
  },
  {
    id: 'survival-care',
    phase: 'survival',
    name: '认真照顾一次自己',
    description: '休息、制作热食，或主动使用一件饮食与药品。',
    rewardPoints: 2,
    matchingActions: ['survival:rest', 'furniture:gas-stove', 'furniture:microwave', 'furniture:electric-hotpot', 'use:'],
  },
  {
    id: 'survival-secure',
    phase: 'survival',
    name: '今晚把门守稳',
    description: '修缮或加固避难所，也可以启动备用电源。',
    rewardPoints: 2,
    matchingActions: ['survival:repair', 'survival:barricade', 'survival:generator'],
  },
];

export const DAILY_WISH_MAP: Record<DailyWishId, DailyWishDefinition> = Object.fromEntries(
  DAILY_WISHES.map((wish) => [wish.id, wish]),
) as Record<DailyWishId, DailyWishDefinition>;

export const DAILY_REWARDS: DailyRewardDefinition[] = [
  { id: 'quiet-rest', name: '留一小时给自己', description: '不再处理清单。体力 +12，精神 +6。', cost: 1 },
  { id: 'water-cache', name: '重新分装饮水', description: '从公共储备中领回瓶装水 ×1，储水 +2。', cost: 2 },
  { id: 'food-cache', name: '整理出一份口粮', description: '找到压缩饼干 ×1、豆类罐头 ×1。', cost: 2 },
  { id: 'repair-kit', name: '夜里补一遍门框', description: '完整度 +10，并留下强力胶带 ×1。', cost: 3 },
  { id: 'charge-pack', name: '集中一次充电', description: '备用电力 +4，并整理出电池组 ×1。', cost: 3 },
  { id: 'first-aid', name: '彻底处理伤口', description: '健康 +12，并处理一项持续伤病。', cost: 3 },
];

export const DAILY_REWARD_MAP: Record<DailyRewardId, DailyRewardDefinition> = Object.fromEntries(
  DAILY_REWARDS.map((reward) => [reward.id, reward]),
) as Record<DailyRewardId, DailyRewardDefinition>;

export function wishesForPhase(phase: Phase): DailyWishDefinition[] {
  if (phase === 'ended') return [];
  return DAILY_WISHES.filter((wish) => wish.phase === phase);
}
