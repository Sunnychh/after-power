import type { GameEvent } from '../types.ts';

export const HARD_LATE_EVENTS: GameEvent[] = [
  {
    id: 'hard-water-corridor', title: '楼道水桶上的名字', phase: 'survival', minDay: 9, maxDay: 14,
    difficulties: ['hard'], inventoryAny: ['water-bottle'], hardStockPressure: true, countsAsContact: true,
    text: '连续围攻后，楼里还能走动的人把空桶排在消防门旁。值守者在每只桶上写了门牌：有老人、有孩子，也有两户已经一天没人回应。他没有问你有多少水，只把名单从门缝递来。',
    options: [
      { label: '拿出两瓶水补公共配给', hint: '瓶装水 -2，精神 +5，守夜支援', result: '两瓶水被分成六份。没人喝饱，但夜间值守表上多了三个愿意出门的名字。', requirements: [{ item: 'water-bottle', quantity: 2 }], effects: { inventory: { 'water-bottle': -2 }, stats: { morale: 5 }, addFlags: ['late-water-shared'] } },
      { label: '只给楼梯口值守者一瓶', hint: '瓶装水 -1，情报 +1', result: '值守者把水分着喝完，也把今晚感染群聚集的楼层告诉了你。', requirements: [{ item: 'water-bottle', quantity: 1 }], effects: { inventory: { 'water-bottle': -1 }, intel: 1 } },
      { label: '说明自己的储备也撑不到撤离', hint: '物资不变，精神 -4', result: '名单上的笔尖停在你的门牌旁，没有再写。空桶继续被搬向下一层。', effects: { stats: { morale: -4 } } },
    ],
  },
  {
    id: 'hard-food-watch', title: '守夜班缺少的一顿饭', phase: 'survival', minDay: 9, maxDay: 14,
    difficulties: ['hard'], inventoryAny: ['canned-beans', 'crackers'], hardStockPressure: true,
    text: '负责敲击管道示警的人已经连守两夜。今天没人来接班，因为公共食物箱只剩包装纸。楼道里的人知道你可能还有耐储食物，但没有人直接敲门讨要。',
    options: [
      { label: '交出一罐豆子作为守夜口粮', hint: '豆子罐头 -1，加固 +1，精神 +3', result: '罐头在值守者之间传了一圈。吃完后，他们把松动的消防门重新顶住。', countsAsContact: true, requirements: [{ item: 'canned-beans', quantity: 1 }], effects: { inventory: { 'canned-beans': -1 }, shelter: { reinforcement: 1 }, stats: { morale: 3 } } },
      { label: '拿一包饼干换一份街面观察', hint: '咸味饼干 -1，情报 +2', result: '年轻值守者边吃边画出尸群移动方向。下一次外出至少不会迎面撞上主潮。', countsAsContact: true, requirements: [{ item: 'crackers', quantity: 1 }], effects: { inventory: { crackers: -1 }, intel: 2 } },
      { label: '把食物留到自己的最后一天', hint: '物资不变，精神 -3', result: '你没有开门。换班时间过去后，警戒管道整夜没有再响。', effects: { stats: { morale: -3 } } },
    ],
  },
  {
    id: 'hard-clinic-triage', title: '林舟的最后一包耗材', phase: 'survival', minDay: 9, maxDay: 14,
    difficulties: ['hard'], inventoryAny: ['bandage', 'disinfectant'], hardStockPressure: true, npc: 'lin-zhou', requiresRadio: true, countsAsContact: true,
    text: '林舟主动报出三名伤员的情况：一个需要重新包扎，两个伤口已经开始发热。她的药箱只够处理其中一人，接下来要看楼里还能凑出什么。',
    options: [
      { label: '送出一卷绷带', hint: '绷带 -1，林舟信任 +9，健康 +3', result: '她把绷带拆成更窄的条带，硬是多处理了一个人，并隔着频道纠正了你的伤口固定方式。', requirements: [{ item: 'bandage', quantity: 1 }], effects: { inventory: { bandage: -1 }, relationships: { 'lin-zhou': 9 }, stats: { health: 3 }, addFlags: ['late-clinic-supplied'] } },
      { label: '提供一瓶消毒液', hint: '消毒液 -1，林舟信任 +7，精神 +3', result: '消毒液先用在最危险的伤口上。林舟让所有人记住你的门牌，但没有许诺偿还。', requirements: [{ item: 'disinfectant', quantity: 1 }], effects: { inventory: { disinfectant: -1 }, relationships: { 'lin-zhou': 7 }, stats: { morale: 3 } } },
      { label: '请她优先保住自己的药箱', hint: '物资不变，林舟信任 -3', result: '频道安静几秒。她说会自己判断，然后结束通话。', effects: { relationships: { 'lin-zhou': -3 } } },
    ],
  },
  {
    id: 'hard-blackout-alarm', title: '警戒线正在掉电', phase: 'survival', minDay: 9, maxDay: 14,
    difficulties: ['hard'], inventoryAny: ['batteries', 'fuel-can'], hardStockPressure: true, npc: 'pan-yue',
    text: '楼道警戒线由几只拆下来的门磁和应急灯拼成。连续震动耗光了电池，地下小发电机也只剩罐底的油。今晚如果完全断电，感染者撞到二楼前不会有任何预警。',
    options: [
      { label: '交出一组电池维持门磁', hint: '电池 -1，加固 +1，潘岳信任 +5', result: '门磁重新逐层亮起。它们挡不住撞击，却能让所有人提前站到正确的位置。', countsAsContact: true, requirements: [{ item: 'batteries', quantity: 1 }], effects: { inventory: { batteries: -1 }, shelter: { reinforcement: 1 }, relationships: { 'pan-yue': 5 }, addFlags: ['late-alarm-powered'] } },
      { label: '把一罐燃料送到地下机房', hint: '密封燃料罐 -1，净水 +8，潘岳信任 +8', result: '发电机带动警戒灯，也让经过楼内滤芯的水泵多运行了几分钟。潘岳把接出的净水优先送回你门口。', countsAsContact: true, requirements: [{ item: 'fuel-can', quantity: 1 }], effects: { inventory: { 'fuel-can': -1 }, shelter: { water: 8 }, relationships: { 'pan-yue': 8 } } },
      { label: '关闭公共警戒，靠自己听门外动静', hint: '物资不变，精神 -5', result: '整夜每一次管道声都像撞击前兆。你没有损失物资，也没有真正睡着。', effects: { stats: { morale: -5, stamina: -3 } } },
    ],
  },
  {
    id: 'hard-stair-breach', title: '底层防火门的第二道裂口', phase: 'survival', minDay: 9, maxDay: 14,
    difficulties: ['hard'], inventoryAny: ['wood-board', 'metal-sheet'], hardStockPressure: true, npc: 'pan-yue', requiresRadio: true, countsAsContact: true,
    text: '昨夜冲击把底层防火门撕出一道能伸进手臂的裂口。潘岳在频道里报出尺寸：普通木板能撑一晚，钢板能把受力重新分回墙体。材料必须在天黑前送下去。',
    options: [
      { label: '用一块木板封住裂口', hint: '木板 -1，完整度 +14，加固 +1', result: '木板压住裂口，剩余木条被钉成三角支撑。它不漂亮，但今晚能分走一部分冲击。', requirements: [{ item: 'wood-board', quantity: 1 }], effects: { inventory: { 'wood-board': -1 }, shelter: { integrity: 14, reinforcement: 1 }, relationships: { 'pan-yue': 4 } } },
      { label: '安装一块预切钢板', hint: '薄钢板 -1，完整度 +22，加固 +2', result: '钢板的六个孔正好对上旧门框。最后一颗螺栓拧紧后，整道门重新成为一块受力面。', requirements: [{ item: 'metal-sheet', quantity: 1 }], effects: { inventory: { 'metal-sheet': -1 }, shelter: { integrity: 22, reinforcement: 2 }, relationships: { 'pan-yue': 7 } } },
      { label: '把自家门后的材料留下', hint: '物资不变，完整度 -5', result: '裂口用家具临时堵住。第一轮撞击还没开始，门框就又向内弯了几毫米。', effects: { shelter: { integrity: -5 } } },
    ],
  },
];
