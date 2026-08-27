import type { ItemDefinition } from '../types.ts';

export const ITEMS: ItemDefinition[] = [
  { id: 'water-bottle', name: '瓶装水', category: '饮水', price: 12, weight: 1.05, description: '一升密封水，最可靠的日常储备。', store: 'market', usable: true, effects: { hydration: 28 }, tags: ['water'], easyPlan: { tier: '必备', target: 6 } },
  { id: 'water-can', name: '折叠水袋', category: '饮水', price: 28, weight: 2.1, description: '两升饮水，装满后有些沉。', store: 'hardware', usable: true, effects: { hydration: 48 }, tags: ['water'] },
  { id: 'sports-drink', name: '电解质饮料', category: '饮水', price: 18, weight: 0.55, description: '补水，也能稍微恢复体力。', store: 'market', usable: true, effects: { hydration: 20, stamina: 8 }, tags: ['water'], easyPlan: { tier: '推荐', target: 2 } },
  { id: 'purifier-tablet', name: '净水片', category: '饮水', price: 32, weight: 0.05, description: '与雨水桶组合，可换来两份安全饮水。', store: 'pharmacy', tags: ['purify', 'combo'] },
  { id: 'crackers', name: '压缩饼干', category: '食物', price: 16, weight: 0.35, description: '耐放，吃完很想喝水。', store: 'market', usable: true, effects: { satiety: 24, hydration: -3 }, tags: ['food'], easyPlan: { tier: '推荐', target: 3 } },
  { id: 'canned-beans', name: '豆类罐头', category: '食物', price: 24, weight: 0.5, description: '一顿扎实的冷食。', store: 'market', usable: true, effects: { satiety: 34, morale: 2 }, tags: ['food'], easyPlan: { tier: '必备', target: 4 } },
  { id: 'instant-noodles', name: '方便面', category: '食物', price: 9, weight: 0.14, description: '有水和炉具时效果更好。', store: 'market', usable: true, effects: { satiety: 18 }, tags: ['food', 'cookable', 'combo'], easyPlan: { tier: '推荐', target: 4 } },
  { id: 'rice', name: '真空米砖', category: '食物', price: 22, weight: 1, description: '需要锅和燃料，能做成三顿热食。', store: 'market', tags: ['ingredient', 'cookable', 'combo'] },
  { id: 'jerky', name: '风干肉', category: '食物', price: 31, weight: 0.25, description: '高热量但盐分很重。', store: 'market', usable: true, effects: { satiety: 30, hydration: -5 }, tags: ['food'] },
  { id: 'fresh-apples', name: '一袋苹果', category: '食物', price: 17, weight: 1.1, description: '封锁前还算新鲜，五天后会坏。', store: 'market', perishableDays: 5, expiredLabel: '已经腐烂', usable: true, effects: { satiety: 16, hydration: 8, morale: 3 }, tags: ['food', 'fresh'] },
  { id: 'chocolate', name: '黑巧克力', category: '食物', price: 14, weight: 0.12, description: '小块热量，也是很好的交换物。', store: 'market', usable: true, effects: { satiety: 12, morale: 8 }, tags: ['food', 'trade'] },
  { id: 'antibiotics', name: '抗生素', category: '药品', price: 68, weight: 0.08, description: '处理感染，数量一直很少。', store: 'pharmacy', usable: true, effects: { health: 14 }, tags: ['medicine', 'infection'], easyPlan: { tier: '推荐', target: 1 } },
  { id: 'bandage', name: '无菌绷带', category: '药品', price: 20, weight: 0.12, description: '处理外伤，防止继续恶化。', store: 'pharmacy', usable: true, effects: { health: 9 }, tags: ['medicine', 'wound'], easyPlan: { tier: '必备', target: 2 } },
  { id: 'painkiller', name: '止痛片', category: '药品', price: 26, weight: 0.04, description: '短暂压住疼痛，恢复行动状态。', store: 'pharmacy', usable: true, effects: { health: 4, stamina: 12 }, tags: ['medicine'] },
  { id: 'disinfectant', name: '消毒液', category: '药品', price: 30, weight: 0.4, description: '伤口处理和避难所清洁都用得上。', store: 'pharmacy', tags: ['medicine', 'clean', 'combo'] },
  { id: 'vitamins', name: '复合维生素', category: '药品', price: 35, weight: 0.1, description: '连续吃几天，身体不容易垮。', store: 'pharmacy', usable: true, effects: { health: 5, morale: 2 }, tags: ['medicine'] },
  { id: 'toolkit', name: '家用工具箱', category: '工具', price: 78, weight: 2.8, description: '修门、拆锁、接线都离不开它。', store: 'hardware', tags: ['tool', 'repair', 'combo'], easyPlan: { tier: '必备', target: 1 } },
  { id: 'crowbar', name: '撬棍', category: '工具', price: 45, weight: 1.4, description: '开路、拆门，也能在危险时壮胆。', store: 'hardware', tags: ['tool', 'weapon'] },
  { id: 'multitool', name: '折叠多用钳', category: '工具', price: 39, weight: 0.28, description: '不够专业，但胜在随身。', store: 'hardware', tags: ['tool', 'repair'] },
  { id: 'rope', name: '尼龙绳', category: '工具', price: 24, weight: 0.7, description: '下楼、捆扎与搭建都能用。', store: 'hardware', tags: ['tool', 'explore'] },
  { id: 'radio', name: '短波收音机', category: '工具', price: 62, weight: 0.75, description: '耗一节电池，接收封锁线外的声音。', store: 'hardware', tags: ['radio', 'intel', 'combo'], easyPlan: { tier: '必备', target: 1 } },
  { id: 'flashlight', name: '强光手电', category: '工具', price: 34, weight: 0.35, description: '夜间探索降低危险，需要电池。', store: 'hardware', tags: ['light', 'explore', 'combo'], easyPlan: { tier: '推荐', target: 1 } },
  { id: 'camp-stove', name: '便携炉头', category: '工具', price: 48, weight: 0.55, description: '配合燃料可制作热食和净水。', store: 'hardware', tags: ['cook', 'combo'] },
  { id: 'batteries', name: '电池组', category: '能源', price: 22, weight: 0.24, description: '给手电或收音机续一次电。', store: 'hardware', usable: true, effects: { power: 8 }, tags: ['battery'], easyPlan: { tier: '必备', target: 3 } },
  { id: 'fuel-can', name: '密封燃料罐', category: '能源', price: 58, weight: 3.2, description: '能让发电机运转两晚。', store: 'fuel', usable: true, effects: { fuel: 18 }, tags: ['fuel'], easyPlan: { tier: '推荐', target: 1 } },
  { id: 'solar-charger', name: '折叠太阳能板', category: '能源', price: 118, weight: 1.9, description: '晴天可缓慢补充电力。', store: 'hardware', tags: ['power', 'solar'] },
  { id: 'candles', name: '长明蜡烛', category: '能源', price: 14, weight: 0.3, description: '不用电的照明，但必须小心火。', store: 'market', tags: ['light'] },
  { id: 'respirator', name: '半面罩呼吸器', category: '防护', price: 72, weight: 0.45, description: '在污染区域显著降低感染风险。', store: 'hardware', tags: ['protection', 'mask'] },
  { id: 'masks', name: '医用口罩包', category: '防护', price: 24, weight: 0.12, description: '三只一次性口罩，出门时消耗。', store: 'pharmacy', tags: ['protection', 'mask'], easyPlan: { tier: '必备', target: 2 } },
  { id: 'raincoat', name: '厚雨衣', category: '防护', price: 36, weight: 0.65, description: '酸雨天外出不会直接伤身。', store: 'hardware', tags: ['protection', 'rain'] },
  { id: 'gloves', name: '耐磨手套', category: '防护', price: 19, weight: 0.2, description: '翻找废墟时少一道伤口。', store: 'hardware', tags: ['protection', 'hands'] },
  { id: 'duct-tape', name: '强力胶带', category: '材料', price: 17, weight: 0.32, description: '修补的通用耗材。', store: 'hardware', tags: ['material', 'repair'] },
  { id: 'wood-board', name: '木板', category: '材料', price: 26, weight: 3.5, description: '加固门窗，结实但占地方。', store: 'hardware', tags: ['material', 'reinforce'] },
  { id: 'metal-sheet', name: '薄钢板', category: '材料', price: 44, weight: 4.2, description: '大幅提高避难所完整度。', store: 'hardware', tags: ['material', 'reinforce'] },
  { id: 'copper-wire', name: '铜线卷', category: '材料', price: 29, weight: 0.6, description: '修电路和广播天线的关键材料。', store: 'hardware', tags: ['material', 'power', 'combo'] },
  { id: 'filter-cloth', name: '活性炭滤布', category: '材料', price: 27, weight: 0.25, description: '配合净水片可处理收集来的雨水。', store: 'pharmacy', tags: ['material', 'purify', 'combo'] },
  { id: 'family-photo', name: '走廊里的合照', category: '特殊', price: 0, weight: 0.06, description: '照片背面写着一串门禁编号。', story: true, tags: ['story', 'memory'] },
  { id: 'lab-badge', name: '疾控中心工牌', category: '特殊', price: 0, weight: 0.04, description: '持有人叫邱岚，权限没有完全失效。', story: true, tags: ['story', 'truth'] },
  { id: 'sample-tube', name: '低温样本管', category: '特殊', price: 0, weight: 0.18, description: '标签被刮去，只剩批次“C-17”。', perishableDays: 6, expiredLabel: '低温样本已经失效', story: true, tags: ['story', 'truth', 'cold'] },
  { id: 'station-key', name: '变电站铜钥匙', category: '特殊', price: 0, weight: 0.08, description: '通往北湖变电站控制层。', story: true, tags: ['story', 'power'] },
  { id: 'bus-manifest', name: '撤离车队名单', category: '特殊', price: 0, weight: 0.03, description: '名单上有几处被红笔改写。', story: true, tags: ['story', 'evacuation'] },
  { id: 'sealed-letter', name: '未寄出的信', category: '特殊', price: 0, weight: 0.02, description: '收件人是封锁线外的一名记者。', story: true, tags: ['story', 'truth'] },
];

export const ITEM_MAP: Record<string, ItemDefinition> = Object.fromEntries(
  ITEMS.map((item) => [item.id, item]),
);

export const STORE_NAMES: Record<string, string> = {
  market: '河西生活超市',
  pharmacy: '青禾药房',
  hardware: '老潘五金行',
  fuel: '环路加油站',
};

export const STORE_DESCRIPTIONS: Record<string, string> = {
  market: '货架还没空。收银员把矿泉水限购写在纸板上。',
  pharmacy: '排队的人不多，退烧药被悄悄移到了柜台下面。',
  hardware: '老板只收现金，门口堆着别人嫌重的木板。',
  fuel: '空气里都是汽油味。散装燃料必须用合格容器。',
};

export const CATEGORY_ORDER = ['饮水', '食物', '药品', '工具', '能源', '防护', '材料', '特殊'] as const;

const EFFECT_NAMES: Record<string, string> = {
  satiety: '饱腹',
  hydration: '水分',
  health: '健康',
  morale: '精神',
  stamina: '体力',
  water: '储水',
  power: '电力',
  fuel: '燃料',
  integrity: '完整度',
};

export function formatItemEffects(item: ItemDefinition): string[] {
  return Object.entries(item.effects ?? {})
    .filter(([, value]) => typeof value === 'number' && value !== 0)
    .map(([key, value]) => `${EFFECT_NAMES[key] ?? key} ${(value ?? 0) > 0 ? '+' : ''}${value}`);
}
