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
  { id: 'paperback', name: '旧版悬疑小说', category: '特殊', price: 19, weight: 0.32, description: '书脊已经开胶，但完整的故事能让注意力暂时离开门外。可反复阅读。', store: 'market', tags: ['entertainment', 'book'] },
  { id: 'playing-cards', name: '缺角扑克牌', category: '特殊', price: 12, weight: 0.1, description: '少了一张方块七，仍能摆接龙或记录独自完成的局数。', store: 'market', tags: ['entertainment', 'cards'] },
  { id: 'antibiotics', name: '抗生素', category: '药品', price: 68, weight: 0.08, description: '处理感染，数量一直很少。', store: 'pharmacy', usable: true, effects: { health: 14 }, tags: ['medicine', 'infection'], easyPlan: { tier: '推荐', target: 1 } },
  { id: 'bandage', name: '无菌绷带', category: '药品', price: 20, weight: 0.12, description: '处理外伤，防止继续恶化。', store: 'pharmacy', usable: true, effects: { health: 9 }, tags: ['medicine', 'wound'], easyPlan: { tier: '必备', target: 2 } },
  { id: 'painkiller', name: '止痛片', category: '药品', price: 26, weight: 0.04, description: '短暂压住疼痛，恢复行动状态。', store: 'pharmacy', usable: true, effects: { health: 4, stamina: 12 }, tags: ['medicine'] },
  { id: 'disinfectant', name: '消毒液', category: '药品', price: 30, weight: 0.4, description: '伤口处理和避难所清洁都用得上。', store: 'pharmacy', tags: ['medicine', 'clean', 'combo'] },
  { id: 'vitamins', name: '复合维生素', category: '药品', price: 35, weight: 0.1, description: '连续吃几天，身体不容易垮。', store: 'pharmacy', usable: true, effects: { health: 5, morale: 2 }, tags: ['medicine'] },
  { id: 'toolkit', name: '家用工具箱', category: '工具', price: 78, weight: 2.8, description: '修门、拆锁、接线都离不开它。', store: 'hardware', tags: ['tool', 'repair', 'combo'], easyPlan: { tier: '必备', target: 1 } },
  { id: 'crowbar', name: '撬棍', category: '工具', price: 45, weight: 1.4, description: '开路、拆门，也能在危险时壮胆。', store: 'hardware', tags: ['tool', 'weapon'] },
  { id: 'multitool', name: '折叠多用钳', category: '工具', price: 39, weight: 0.28, description: '不够专业，但胜在随身。', store: 'hardware', tags: ['tool', 'repair'] },
  { id: 'lockpick-set', name: '薄片开锁组', category: '工具', price: 48, weight: 0.12, description: '几片张力扳手与练习锁芯。安静开门需要耐心，也需要经验。', store: 'hardware', tags: ['tool', 'lockpick', 'explore'], easyPlan: { tier: '推荐', target: 1 } },
  { id: 'hatchet', name: '短柄手斧', category: '工具', price: 64, weight: 1.3, description: '能劈木、破薄铁皮，也会制造很远都听得见的动静。', store: 'hardware', tags: ['tool', 'weapon', 'explore'] },
  { id: 'rope', name: '尼龙绳', category: '工具', price: 24, weight: 0.7, description: '下楼、捆扎与搭建都能用。', store: 'hardware', tags: ['tool', 'explore'] },
  { id: 'radio', name: '短波收音机', category: '工具', price: 62, weight: 0.75, description: '耗一节电池，接收封锁线外的声音。', store: 'hardware', tags: ['radio', 'intel', 'combo'], easyPlan: { tier: '必备', target: 1 } },
  { id: 'music-player', name: '旧音乐播放器', category: '工具', price: 43, weight: 0.16, description: '里面留着几张旧专辑。每次播放需要 1 点备用电力，缺电时可消耗一组电池。', store: 'hardware', tags: ['entertainment', 'music'], easyPlan: { tier: '推荐', target: 1 } },
  { id: 'flashlight', name: '强光手电', category: '工具', price: 34, weight: 0.35, description: '夜间探索降低危险，需要电池。', store: 'hardware', tags: ['light', 'explore', 'combo'], easyPlan: { tier: '推荐', target: 1 } },
  { id: 'camp-stove', name: '便携炉头', category: '工具', price: 48, weight: 0.55, description: '配合燃料可制作热食和净水。', store: 'hardware', tags: ['cook', 'combo'] },
  { id: 'fuel-generator', name: '静音燃油发电机', category: '能源', price: 136, weight: 8.6, description: '发电机本体。需先完成一级供电改造；每运行 30 分钟消耗 3 点燃料，补充 5 点电力。', store: 'hardware', tags: ['generator', 'power'], easyPlan: { tier: '推荐', target: 1 } },
  { id: 'batteries', name: '电池组', category: '能源', price: 22, weight: 0.24, description: '可直接供收音机使用一次，或并入备用回路补充 3 点电力。', store: 'hardware', usable: true, effects: { power: 3 }, tags: ['battery'], easyPlan: { tier: '必备', target: 3 } },
  { id: 'fuel-can', name: '密封燃料罐', category: '能源', price: 58, weight: 3.2, description: '含 6 点可用燃料，可让发电机短时运转两次。', store: 'fuel', usable: true, effects: { fuel: 6 }, tags: ['fuel'], easyPlan: { tier: '推荐', target: 1 } },
  { id: 'solar-charger', name: '折叠太阳能板', category: '能源', price: 118, weight: 1.9, description: '晴天可缓慢补充电力。', store: 'hardware', tags: ['power', 'solar'] },
  { id: 'candles', name: '长明蜡烛', category: '能源', price: 14, weight: 0.3, description: '不用电的照明，但必须小心火。', store: 'market', tags: ['light'] },
  { id: 'respirator', name: '半面罩呼吸器', category: '防护', price: 72, weight: 0.45, description: '在污染区域显著降低感染风险。', store: 'hardware', tags: ['protection', 'mask'] },
  { id: 'masks', name: '医用口罩包', category: '防护', price: 24, weight: 0.12, description: '三只一次性口罩，出门时消耗。', store: 'pharmacy', tags: ['protection', 'mask'], easyPlan: { tier: '必备', target: 2 } },
  { id: 'raincoat', name: '厚雨衣', category: '防护', price: 36, weight: 0.65, description: '酸雨天外出不会直接伤身。', store: 'hardware', tags: ['protection', 'rain'] },
  { id: 'gloves', name: '耐磨手套', category: '防护', price: 19, weight: 0.2, description: '翻找废墟时少一道伤口。', store: 'hardware', tags: ['protection', 'hands'] },
  { id: 'duct-tape', name: '强力胶带', category: '材料', price: 17, weight: 0.32, description: '修补的通用耗材。', store: 'hardware', tags: ['material', 'repair'] },
  { id: 'wood-board', name: '木板', category: '材料', price: 26, weight: 3.5, description: '封锁后耗时 2 小时安装：完整度 +20、加固 +1。', store: 'hardware', effects: { integrity: 20 }, tags: ['material', 'reinforce'] },
  { id: 'metal-sheet', name: '薄钢板', category: '材料', price: 44, weight: 4.2, description: '需工具箱并耗时 2 小时 30 分安装：完整度 +32、加固 +2。', store: 'hardware', effects: { integrity: 32 }, tags: ['material', 'reinforce'] },
  { id: 'copper-wire', name: '铜线卷', category: '材料', price: 29, weight: 0.6, description: '修电路和广播天线的关键材料。', store: 'hardware', tags: ['material', 'power', 'combo'] },
  { id: 'metal-scrap', name: '可用金属件', category: '材料', price: 0, weight: 0.35, description: '从锁具与货架上完整拆下的金属件，可用于修补。', tags: ['material', 'repair'] },
  { id: 'filter-cloth', name: '活性炭滤布', category: '材料', price: 27, weight: 0.25, description: '配合净水片可处理收集来的雨水。', store: 'pharmacy', tags: ['material', 'purify', 'combo'] },
  { id: 'juice-box', name: '常温果汁盒', category: '饮水', price: 15, weight: 0.28, description: '封装果汁，能补水，也有一点甜味。', store: 'market', perishableDays: 9, expiredLabel: '已经酸败', usable: true, effects: { hydration: 17, morale: 3 }, tags: ['water', 'drink'] },
  { id: 'canned-soda', name: '罐装苏打水', category: '饮水', price: 11, weight: 0.36, description: '不算健康，但气泡在停电后很奢侈。', store: 'market', usable: true, effects: { hydration: 13, morale: 5 }, tags: ['water', 'drink'] },
  { id: 'instant-coffee', name: '速溶咖啡条', category: '饮水', price: 18, weight: 0.06, description: '需要少量水冲泡，也可以干嚼应急。', store: 'market', usable: true, effects: { stamina: 12, morale: 3, hydration: -2 }, tags: ['drink', 'ingredient', 'cookable'] },
  { id: 'oats', name: '即食燕麦', category: '食物', price: 19, weight: 0.42, description: '耐储主食，用热水就能做成粥。', store: 'market', usable: true, effects: { satiety: 15 }, tags: ['food', 'ingredient', 'cookable'] },
  { id: 'flour', name: '密封面粉', category: '食物', price: 21, weight: 0.8, description: '能做面糊和烙饼，需要油与水。', store: 'market', tags: ['ingredient', 'cookable'] },
  { id: 'dried-vegetables', name: '脱水蔬菜包', category: '食物', price: 17, weight: 0.12, description: '泡开后分量不多，但能让热食更像一顿饭。', store: 'market', tags: ['ingredient', 'cookable', 'vegetable'] },
  { id: 'egg-powder', name: '全蛋粉', category: '食物', price: 26, weight: 0.2, description: '加水能恢复成蛋液，密封状态很耐放。', store: 'market', tags: ['ingredient', 'cookable', 'protein'] },
  { id: 'milk-powder', name: '独立装奶粉', category: '食物', price: 24, weight: 0.18, description: '能直接补充热量，冲调后更容易入口。', store: 'market', usable: true, effects: { satiety: 10, health: 2 }, tags: ['food', 'ingredient', 'cookable'] },
  { id: 'luncheon-meat', name: '午餐肉罐头', category: '食物', price: 29, weight: 0.36, description: '可以直接吃，和其他食材同煮效果更好。', store: 'market', usable: true, effects: { satiety: 27, morale: 2, hydration: -3 }, tags: ['food', 'ingredient', 'cookable', 'protein'] },
  { id: 'potatoes', name: '一袋小土豆', category: '食物', price: 18, weight: 1.15, description: '能煮、能烤，八天后会开始发芽变软。', store: 'market', perishableDays: 8, expiredLabel: '已经发芽腐坏', tags: ['ingredient', 'cookable', 'vegetable'] },
  { id: 'dried-mushrooms', name: '干香菇', category: '食物', price: 23, weight: 0.1, description: '少量就能让一锅清水有味道。', store: 'market', tags: ['ingredient', 'cookable', 'vegetable'] },
  { id: 'bouillon', name: '浓汤块', category: '食物', price: 13, weight: 0.08, description: '盐分很高，是简陋热汤的底味。', store: 'market', tags: ['ingredient', 'cookable', 'seasoning'] },
  { id: 'cooking-oil', name: '小瓶食用油', category: '食物', price: 25, weight: 0.32, description: '煎烙食物的基础油脂，瓶盖必须拧紧。', store: 'market', tags: ['ingredient', 'cookable', 'seasoning'] },
  { id: 'soy-sauce', name: '旅行装酱油', category: '食物', price: 10, weight: 0.16, description: '不提供多少热量，但能改善重复口粮。', store: 'market', tags: ['ingredient', 'cookable', 'seasoning'] },
  { id: 'frozen-dumplings', name: '冷冻素饺', category: '食物', price: 32, weight: 0.62, description: '断电后很快解冻，四天内必须吃掉。', store: 'market', perishableDays: 4, expiredLabel: '已经变质粘连', tags: ['ingredient', 'cookable'] },
  { id: 'tomato-can', name: '番茄罐头', category: '食物', price: 20, weight: 0.42, description: '带酸味的烹饪底料，也可以直接冷食。', store: 'market', usable: true, effects: { satiety: 13, hydration: 7, morale: 2 }, tags: ['food', 'ingredient', 'cookable', 'vegetable'] },

  { id: 'dish-vegetable-congee', name: '蔬菜米粥', category: '食物', price: 0, weight: 0.58, description: '米粒煮得很软，脱水蔬菜重新有了颜色。', perishableDays: 2, expiredLabel: '已经馊掉', usable: true, effects: { satiety: 42, hydration: 10, morale: 7, stamina: 4 }, tags: ['food', 'cooked'] },
  { id: 'dish-potato-stew', name: '土豆午餐肉炖锅', category: '食物', price: 0, weight: 0.72, description: '油脂和淀粉让这一小锅很顶饿。', perishableDays: 2, expiredLabel: '已经变味', usable: true, effects: { satiety: 55, hydration: 7, morale: 10, stamina: 5 }, tags: ['food', 'cooked'] },
  { id: 'dish-mushroom-noodles', name: '香菇汤面', category: '食物', price: 0, weight: 0.52, description: '汤很淡，但香菇味让方便面有了变化。', perishableDays: 2, expiredLabel: '汤面已经酸败', usable: true, effects: { satiety: 44, hydration: 12, morale: 9, stamina: 4 }, tags: ['food', 'cooked'] },
  { id: 'dish-flatbread', name: '简易油烙饼', category: '食物', price: 0, weight: 0.38, description: '形状不太圆，焦边却很香。', perishableDays: 3, expiredLabel: '已经霉变', usable: true, effects: { satiety: 39, morale: 8, stamina: 3 }, tags: ['food', 'cooked'] },
  { id: 'dish-milk-oatmeal', name: '奶香燕麦糊', category: '食物', price: 0, weight: 0.38, description: '温热柔软，适合在体力见底时吃。', perishableDays: 2, expiredLabel: '已经酸败', usable: true, effects: { satiety: 35, hydration: 8, health: 3, morale: 8, stamina: 6 }, tags: ['food', 'cooked'] },
  { id: 'dish-bean-hash', name: '豆子午餐肉烩', category: '食物', price: 0, weight: 0.55, description: '咸而扎实，微波炉让油脂重新融化。', perishableDays: 2, expiredLabel: '已经变质', usable: true, effects: { satiety: 52, morale: 8, stamina: 4, hydration: -2 }, tags: ['food', 'cooked'] },
  { id: 'dish-microwave-potato', name: '酱香焖土豆', category: '食物', price: 0, weight: 0.48, description: '土豆外皮皱了，里面仍然松软。', perishableDays: 2, expiredLabel: '已经发黏', usable: true, effects: { satiety: 37, morale: 7, stamina: 3 }, tags: ['food', 'cooked'] },
  { id: 'dish-steamed-egg', name: '杯装蒸蛋', category: '食物', price: 0, weight: 0.3, description: '表面有些气孔，但仍是一份温和的蛋羹。', perishableDays: 2, expiredLabel: '已经变质', usable: true, effects: { satiety: 30, hydration: 7, health: 4, morale: 8 }, tags: ['food', 'cooked'] },
  { id: 'dish-dumpling-soup', name: '蔬菜饺子汤', category: '食物', price: 0, weight: 0.68, description: '饺子有几只煮破了，汤反而更浓。', perishableDays: 2, expiredLabel: '已经酸败', usable: true, effects: { satiety: 50, hydration: 15, morale: 11, stamina: 5 }, tags: ['food', 'cooked'] },
  { id: 'dish-boiled-dumplings', name: '清水煮饺子', category: '食物', price: 0, weight: 0.64, description: '没有配菜，至少水量足够，饺子完整地浮在热汤里。', perishableDays: 2, expiredLabel: '已经酸败粘连', usable: true, effects: { satiety: 42, hydration: 7, morale: 7, stamina: 3 }, tags: ['food', 'cooked'] },
  { id: 'dish-dry-dumplings', name: '干煎水饺', category: '食物', price: 0, weight: 0.46, description: '没有水，只能贴着锅底慢慢翻面。外皮很硬，但还算是一顿热食。', perishableDays: 2, expiredLabel: '已经变质', usable: true, effects: { satiety: 34, hydration: -3, morale: 4 }, tags: ['food', 'cooked', 'improvised'] },
  { id: 'dish-scorched-dumplings', name: '糊底水饺', category: '食物', price: 0, weight: 0.4, description: '水饺在干锅里裂开，底部焦黑。刮掉最苦的部分后勉强还能吃。', perishableDays: 1, expiredLabel: '已经彻底不能吃', usable: true, effects: { satiety: 17, hydration: -4, morale: -4 }, tags: ['food', 'cooked', 'failed', 'improvised'] },
  { id: 'dish-improvised-meal', name: '临时热杂烩', category: '食物', price: 0, weight: 0.34, description: '谈不上配方，只是把手头的食材尽量加热到合适入口。', perishableDays: 2, expiredLabel: '已经变味', usable: true, effects: { satiety: 23, morale: 2 }, tags: ['food', 'cooked', 'improvised'] },
  { id: 'dish-mushroom-broth', name: '香菇清汤', category: '食物', price: 0, weight: 0.46, description: '一碗有咸味和热气的汤，比名字更重要。', perishableDays: 2, expiredLabel: '已经酸败', usable: true, effects: { satiety: 24, hydration: 19, morale: 10, health: 2 }, tags: ['food', 'cooked'] },
  { id: 'dish-mixed-hotpot', name: '杂烩小火锅', category: '食物', price: 0, weight: 0.82, description: '土豆、肉和蔬菜挤在一只小锅里，分量难得充足。', perishableDays: 2, expiredLabel: '已经变质', usable: true, effects: { satiety: 63, hydration: 12, morale: 14, stamina: 7 }, tags: ['food', 'cooked'] },
  { id: 'dish-tomato-noodles', name: '番茄汤面', category: '食物', price: 0, weight: 0.58, description: '番茄的酸味盖住了方便面的调料味。', perishableDays: 2, expiredLabel: '汤面已经酸败', usable: true, effects: { satiety: 46, hydration: 15, morale: 11, stamina: 4 }, tags: ['food', 'cooked'] },
  { id: 'scorched-meal', name: '勉强能吃的失败料理', category: '食物', price: 0, weight: 0.28, description: '火候或比例出了问题。浪费更可惜，所以还能吃。', perishableDays: 1, expiredLabel: '已经彻底不能吃', usable: true, effects: { satiety: 12, morale: -4 }, tags: ['food', 'cooked', 'failed'] },
  { id: 'family-photo', name: '走廊里的合照', category: '特殊', price: 0, weight: 0.06, description: '照片背面写着一串门禁编号。', story: true, tags: ['story', 'memory'] },
  { id: 'warehouse-key', name: '后仓铜钥匙', category: '特殊', price: 0, weight: 0.03, description: '钥匙牌写着“河西超市·后仓”，边缘还带着潮气。', story: true, tags: ['story', 'key'] },
  { id: 'lab-badge', name: '疾控中心工牌', category: '特殊', price: 0, weight: 0.04, description: '持有人叫邱岚，权限没有完全失效。', story: true, tags: ['story', 'truth'] },
  { id: 'sample-tube', name: '低温样本管', category: '特殊', price: 0, weight: 0.18, description: '标签被刮去，只剩批次“C-17”。', perishableDays: 6, expiredLabel: '低温样本已经失效', story: true, tags: ['story', 'truth', 'cold'] },
  { id: 'station-key', name: '变电站铜钥匙', category: '特殊', price: 0, weight: 0.08, description: '可低风险开启北湖变电站控制层；不会在使用后消耗。', story: true, tags: ['story', 'power'] },
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
