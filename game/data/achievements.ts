import type { AchievementId } from '../types.ts';

export type AchievementCategory = '生存' | '探索' | '料理' | '关系' | '挑战' | '结局';

export interface AchievementDefinition {
  id: AchievementId;
  name: string;
  category: AchievementCategory;
  description: string;
  requirement: string;
  target: number;
  hidden?: boolean;
}

/**
 * Achievement copy and thresholds live here; state inspection is implemented in
 * the achievement engine so content can grow without coupling UI to GameState.
 */
export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'first-night',
    name: '听见第二次清晨',
    category: '生存',
    description: '封锁后的第一夜没有让你的记录中断。',
    requirement: '撑过封锁第 1 夜。',
    target: 1,
  },
  {
    id: 'district-scout',
    name: '街区踏查',
    category: '探索',
    description: '三处地点已经不再只是地图上的名字。',
    requirement: '从 3 个不同地点完成探索并返回。',
    target: 3,
  },
  {
    id: 'city-cartographer',
    name: '封锁区绘图员',
    category: '探索',
    description: '六处主要地点都留下了你的往返路线。',
    requirement: '从全部 6 个探索地点完成探索并返回。',
    target: 6,
  },
  {
    id: 'field-specialist',
    name: '现场有办法',
    category: '探索',
    description: '反复实践把一种现场技巧练成了可靠本领。',
    requirement: '任意探索技能达到 3 级。',
    target: 3,
  },
  {
    id: 'first-recipe',
    name: '厨房里的第一条记录',
    category: '料理',
    description: '一次成功的尝试从未知组合变成了可复现的配方。',
    requirement: '发现 1 道料理配方。',
    target: 1,
  },
  {
    id: 'seasoned-cook',
    name: '停电厨房熟手',
    category: '料理',
    description: '火候、器具和有限食材开始听从你的判断。',
    requirement: '料理技能达到 3 级。',
    target: 3,
  },
  {
    id: 'recipe-collector',
    name: '断粮也要换口味',
    category: '料理',
    description: '你的配方页已经足够撑起一张小小的末日菜单。',
    requirement: '累计发现 8 道不同料理。',
    target: 8,
  },
  {
    id: 'first-alliance',
    name: '不是一个人',
    category: '关系',
    description: '一次主动经营的信任变成了真正的共同防线。',
    requirement: '与 1 名幸存者正式结盟。',
    target: 1,
  },
  {
    id: 'full-coalition',
    name: '四种立场，一张桌子',
    category: '关系',
    description: '分歧没有消失，但四名幸存者都愿意与你并肩行动。',
    requirement: '与全部 4 名具名幸存者结盟。',
    target: 4,
  },
  {
    id: 'live-wire',
    name: '让电流守门',
    category: '挑战',
    description: '在最紧张的物资条件下，你把备用电变成了主动防线。',
    requirement: '艰难难度中把电力陷阱升级到 2 级。',
    target: 2,
  },
  {
    id: 'hard-survivor',
    name: '艰难不是讣告',
    category: '挑战',
    description: '高压围攻与稀缺库存都没能截断这轮记录。',
    requirement: '在艰难难度达成任意非死亡结局。',
    target: 1,
  },
  {
    id: 'ending-death',
    name: '记录仍会留下',
    category: '结局',
    description: '死亡结束了一轮，但它没有抹掉你已经知道的事。',
    requirement: '见证任意死亡结局。',
    target: 1,
  },
  {
    id: 'ending-survivor',
    name: '活着离城',
    category: '结局',
    description: '你选择了一条能走通的路，并把自己带出了封锁区。',
    requirement: '达成任意普通幸存结局。',
    target: 1,
  },
  {
    id: 'ending-truth',
    name: '信号越过封锁线',
    category: '结局',
    description: '被隐藏的证据终于抵达城外。',
    requirement: '达成任意隐藏真相结局。',
    target: 1,
    hidden: true,
  },
  {
    id: 'ending-collection',
    name: '三种结局都不是终点',
    category: '结局',
    description: '死亡、幸存与真相都已经成为轮回记忆的一部分。',
    requirement: '在不同轮回中收集死亡、普通幸存与隐藏真相三类结局。',
    target: 3,
    hidden: true,
  },
];

export const ACHIEVEMENT_MAP: Record<AchievementId, AchievementDefinition> = Object.fromEntries(
  ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]),
) as Record<AchievementId, AchievementDefinition>;
