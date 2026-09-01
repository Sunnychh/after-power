import type { AchievementId, DifficultyId } from '../types.ts';

export type AchievementCategory = '生存' | '探索' | '料理' | '关系' | '挑战' | '结局';

export interface AchievementDefinition {
  id: AchievementId;
  name: string;
  category: AchievementCategory;
  description: string;
  requirement: string;
  target: number;
  hidden?: boolean;
  difficulty?: DifficultyId | 'all-three';
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
    id: 'recipe-master',
    name: '停电厨房菜单墙',
    category: '料理',
    description: '十六种成功做法把临时灶台变成了一间真正的厨房。',
    requirement: '累计发现 16 道不同料理。',
    target: 16,
  },
  {
    id: 'pantry-variety',
    name: '不是只有瓶装水',
    category: '生存',
    description: '储物架上已经形成足以轮换口味的食物与饮品组合。',
    requirement: '同时持有 12 种不同的食物或饮水。',
    target: 12,
  },
  {
    id: 'shelter-ready',
    name: '门后还有余量',
    category: '生存',
    description: '避难所不再只靠原来的门框承受下一次撞击。',
    requirement: '完整度达到 90，且门窗加固达到 2 级。',
    target: 1,
  },
  {
    id: 'all-rounder',
    name: '每扇门都有办法',
    category: '探索',
    description: '开锁、工具使用和观察搜寻都不再只是临时碰运气。',
    requirement: '三项探索技能全部达到 2 级。',
    target: 3,
  },
  {
    id: 'broadcast-circle',
    name: '频段上有四个名字',
    category: '关系',
    description: '广播不再只是底噪，四次有效接收组成了一张关系网。',
    requirement: '完成 4 次有效广播。',
    target: 4,
  },
  {
    id: 'long-haul',
    name: '第十个清晨',
    category: '挑战',
    description: '封锁已经超过最初的预期，而你仍然在记录日期。',
    requirement: '在同一轮中抵达封锁第 10 天。',
    target: 10,
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
    id: 'easy-survivor',
    name: '从容离城',
    category: '挑战',
    description: '你在宽松的物资条件里走完了一轮，也看清了这座城市的基本规则。',
    requirement: '在简易难度达成任意非死亡结局。',
    target: 1,
    difficulty: 'easy',
  },
  {
    id: 'easy-good-life',
    name: '封锁期也要好好吃饭',
    category: '料理',
    description: '充足物资没有变成一排罐头，而是被你做成了能安抚人心的菜单。',
    requirement: '简易难度中发现 12 道料理，并让精神达到 70。',
    target: 1,
    difficulty: 'easy',
  },
  {
    id: 'easy-coalition',
    name: '门一直为人留着',
    category: '关系',
    description: '你把相对从容的时间用来理解每一种立场，四个人最终都坐到了桌边。',
    requirement: '简易难度中与全部 4 名具名幸存者结盟。',
    target: 4,
    difficulty: 'easy',
  },
  {
    id: 'normal-survivor',
    name: '标准答案不存在',
    category: '挑战',
    description: '没有额外宽容，也没有极端惩罚；你靠自己的取舍走出了封锁区。',
    requirement: '在标准难度达成任意非死亡结局。',
    target: 1,
    difficulty: 'normal',
  },
  {
    id: 'normal-manual-survivor',
    name: '每一口都由自己决定',
    category: '挑战',
    description: '整轮没有把配给交给自动规则，你亲自承担了每次补给的时机与代价。',
    requirement: '关闭夜间自动补充，在标准难度达成非死亡结局。',
    target: 1,
    difficulty: 'normal',
  },
  {
    id: 'normal-balanced',
    name: '不是勉强撑到终点',
    category: '生存',
    description: '撤离时身体、心态和避难所都还留有余量，这是一场真正受控的生存。',
    requirement: '标准难度达成非死亡结局时，饱腹、水分、健康、精神均不低于 45，避难所完整度不低于 50。',
    target: 1,
    difficulty: 'normal',
  },
  {
    id: 'live-wire',
    name: '让电流守门',
    category: '挑战',
    description: '在最紧张的物资条件下，你把备用电变成了主动防线。',
    requirement: '艰难难度中把电力陷阱升级到 2 级。',
    target: 2,
    difficulty: 'hard',
  },
  {
    id: 'hard-survivor',
    name: '艰难不是讣告',
    category: '挑战',
    description: '高压围攻与稀缺库存都没能截断这轮记录。',
    requirement: '在艰难难度达成任意非死亡结局。',
    target: 1,
    difficulty: 'hard',
  },
  {
    id: 'hard-debt-cleared',
    name: '催收者没能等到你倒下',
    category: '挑战',
    description: '稀缺、尸潮和利息同时压来，你仍在离城前亲手清掉了那笔贷款。',
    requirement: '艰难难度中结清开局贷款，并达成非死亡结局。',
    target: 1,
    difficulty: 'hard',
  },
  {
    id: 'difficulty-triad',
    name: '三种活法',
    category: '挑战',
    description: '从容、克制与高压都留下了不同答案；难度不再只是标题页上的一个选项。',
    requirement: '分别在简易、标准和艰难难度达成非死亡结局。',
    target: 3,
    difficulty: 'all-three',
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
