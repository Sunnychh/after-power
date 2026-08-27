import type { GameEvent } from '../types.ts';

export const EVENTS: GameEvent[] = [
  {
    id: 'prep-rumor', title: '业主群里的截图', phase: 'prep', minDay: 1, maxDay: 2,
    text: '凌晨的业主群里，有人发出一张“分区封控演练表”，三分钟后又撤回。表格上的日期正好是七天后。',
    options: [
      { label: '保存截图并核对地址', hint: '情报 +1，精神 -2', result: '你对照了三处街道名称。都是真的。', effects: { intel: 1, stats: { morale: -2 }, addFlags: ['saw-lockdown-list'] } },
      { label: '先不惊动任何人', hint: '精神 +2', result: '你关掉群聊，把不安写进采购清单。', effects: { stats: { morale: 2 } } },
    ],
  },
  {
    id: 'prep-shortage', title: '货架上的空格', phase: 'prep', minDay: 2, maxDay: 4,
    text: '超市的盐和大桶水被搬空了一排。导购说只是配送车晚点，手却一直攥着手机。',
    options: [
      { label: '问清下一批到货时间', hint: '情报 +1', result: '配送系统里，四天后的线路已经被全部取消。', effects: { intel: 1, addFlags: ['supply-cutoff-known'] } },
      { label: '买下角落两瓶水', hint: '金钱 -24，瓶装水 +2', result: '塑料袋勒得手疼，但你没有后悔。', requirements: [{ minStat: { stamina: 1 } }], effects: { money: -24, inventory: { 'water-bottle': 2 } } },
      { label: '离开', hint: '无消耗', result: '你记住了货架上越来越宽的空白。' },
    ],
  },
  {
    id: 'prep-elevator', title: '电梯检修', phase: 'prep', minDay: 3, maxDay: 6,
    text: '物业把电梯停了半天。师傅说控制板没坏，是上面要求做一次“断电切换测试”。',
    options: [
      { label: '帮忙搬应急电源', hint: '体力 -8，电力 +3', result: '师傅送了你一块还能用的备用电芯。', effects: { stats: { stamina: -8 }, shelter: { power: 3 } } },
      { label: '询问切换细节', hint: '情报 +1', result: '整片区域的备用线路只能撑四个小时。', effects: { intel: 1 } },
      { label: '走楼梯回家', hint: '体力 -2', result: '楼梯间的感应灯比平时暗。', effects: { stats: { stamina: -2 } } },
    ],
  },
  {
    id: 'prep-pharmacy', title: '药房的纸箱', phase: 'prep', minDay: 4, maxDay: 7,
    text: '青禾药房门口堆着退货纸箱。店员说有一批药被临时征调，收货地址是城东体育馆。',
    options: [
      { label: '记下征调单号', hint: '情报 +1，解锁线索', result: '单号前缀属于疾控中心，不是医院。', effects: { intel: 1, addFlags: ['cdc-order-known'] } },
      { label: '帮店员整理纸箱', hint: '绷带 +1，体力 -5', result: '她没多解释，临走塞给你一卷绷带。', effects: { inventory: { bandage: 1 }, stats: { stamina: -5 } } },
      { label: '不打听', hint: '精神 +1', result: '知道得少一点，今晚也许更好睡。', effects: { stats: { morale: 1 } } },
    ],
  },

  {
    id: 'stairwell-1', title: '楼梯间的三下敲门', phase: 'survival', minDay: 1, maxDay: 4,
    text: '夜里有人按三短一长敲防火门。林舟隔着门说，楼下有个孩子发烧，她只需要干净的水。', chain: { id: 'stairwell', step: 1 }, npc: 'lin-zhou',
    options: [
      { label: '从门缝递出一瓶水', hint: '瓶装水 -1，林舟信任 +16', result: '她没有说谢谢，只报了孩子的体温。那比客套更让人安心。', requirements: [{ item: 'water-bottle', quantity: 1 }], effects: { inventory: { 'water-bottle': -1 }, relationships: { 'lin-zhou': 16 }, addFlags: ['stairwell-helped'] } },
      { label: '让她去找物业水箱', hint: '精神 -3', result: '脚步声停了很久，才向楼下走去。', effects: { stats: { morale: -3 }, addFlags: ['stairwell-refused'] } },
      { label: '隔门说明自己也缺水', hint: '林舟信任 +3', result: '她说理解，并提醒你别直接喝楼顶水箱的水。', effects: { relationships: { 'lin-zhou': 3 }, addFlags: ['stairwell-spoke'] } },
    ],
  },
  {
    id: 'stairwell-2', title: '退回来的瓶子', phase: 'survival', minDay: 3, maxDay: 8,
    text: '门外放着那只空水瓶，里面卷着一张诊所药柜的简图。林舟在楼道另一头等你的回应。', chain: { id: 'stairwell', step: 2 }, npc: 'lin-zhou', requiresFlags: ['stairwell-helped'],
    options: [
      { label: '收下简图', hint: '情报 +1，林舟信任 +8', result: '她标出了诊所里没有被搬空的抽屉。', effects: { intel: 1, relationships: { 'lin-zhou': 8 }, addFlags: ['clinic-map'] } },
      { label: '把一块巧克力放回去', hint: '巧克力 -1，精神 +7', result: '第二天，楼下孩子在门后哼了两句跑调的歌。', requirements: [{ item: 'chocolate', quantity: 1 }], effects: { inventory: { chocolate: -1 }, stats: { morale: 7 }, relationships: { 'lin-zhou': 5 } } },
      { label: '只把瓶子收回来', hint: '无消耗', result: '在这里，容器本身也值得被认真保存。' },
    ],
  },
  {
    id: 'signal-1', title: '九十七点三兆赫', phase: 'survival', minDay: 2, maxDay: 6,
    text: '收音机的噪声里插进一个女人的声音：“如果你在河西，记住九十七点三，双数日零点。”', chain: { id: 'signal', step: 1 }, npc: 'qiu-lan',
    options: [
      { label: '抄下频率与时刻', hint: '情报 +1', result: '声音只重复两遍。你把数字写在墙上。', effects: { intel: 1, addFlags: ['qiu-frequency'] } },
      { label: '继续调台寻找官方广播', hint: '电力 -2，精神 +2', result: '官方频道仍在播放循环录音。至少它听起来熟悉。', effects: { shelter: { power: -2 }, stats: { morale: 2 } } },
      { label: '关掉收音机', hint: '无消耗', result: '房间重新安静，只有冰箱停机后的滴水声。' },
    ],
  },
  {
    id: 'signal-2', title: '检验员的报码', phase: 'survival', minDay: 4, maxDay: 10,
    text: '零点，那个声音准时出现。她自称邱岚，说感染数据被人为删改，需要有人保留一份校验码。', chain: { id: 'signal', step: 2 }, npc: 'qiu-lan', requiresFlags: ['qiu-frequency'],
    options: [
      { label: '逐字记录校验码', hint: '情报 +2，邱岚信任 +15', result: '报码持续了四分钟。最后一句是：“别相信空载撤离车。”', effects: { intel: 2, relationships: { 'qiu-lan': 15 }, addFlags: ['decoded-broadcast', 'evidence-signal'] } },
      { label: '要求她先证明身份', hint: '邱岚信任 +5', result: '她报出青禾诊所一只旧药柜的编号。林舟确认编号是真的。', effects: { relationships: { 'qiu-lan': 5 }, addFlags: ['qiu-verified'] } },
      { label: '不卷进这件事', hint: '精神 +3', result: '你擦掉墙上的频率，却记得每一个数字。', effects: { stats: { morale: 3 } } },
    ],
  },
  {
    id: 'rooftop-1', title: '楼顶的咳嗽声', phase: 'survival', minDay: 2, maxDay: 6,
    text: '收集雨水时，你听见水箱后有人咳嗽。陈檬从阴影里走出来，口罩已经湿透。', chain: { id: 'rooftop', step: 1 }, npc: 'chen-meng',
    options: [
      { label: '给她一只口罩', hint: '口罩包 -1，陈檬信任 +14', result: '她记下你门牌号，说社区仓里还有一批没登记的物资。', requirements: [{ item: 'masks', quantity: 1 }], effects: { inventory: { masks: -1 }, relationships: { 'chen-meng': 14 }, addFlags: ['chen-helped'] } },
      { label: '保持距离询问情况', hint: '情报 +1', result: '她说并不是所有被带走的人都有症状。', effects: { intel: 1, addFlags: ['chen-spoke'] } },
      { label: '立即离开', hint: '感染风险低，精神 -2', result: '你把楼顶门反锁，咳嗽声隔着铁门继续。', effects: { stats: { morale: -2 } } },
    ],
  },
  {
    id: 'rooftop-2', title: '社区仓的钥匙', phase: 'survival', minDay: 5, maxDay: 10,
    text: '陈檬把一把小钥匙压在门垫下。纸条写着：“只拿你真需要的，给后面的人留一份。”', chain: { id: 'rooftop', step: 2 }, npc: 'chen-meng', requiresFlags: ['chen-helped'],
    options: [
      { label: '只取一份水和绷带', hint: '瓶装水 +1，绷带 +1，信任 +10', result: '货架上还剩几份。你重新锁好门。', effects: { inventory: { 'water-bottle': 1, bandage: 1 }, relationships: { 'chen-meng': 10 }, addFlags: ['community-fair'] } },
      { label: '尽量装满背包', hint: '食物 +2，水 +2，信任 -18', result: '你拿走能拿的。钥匙第二天就不再能打开那扇门。', effects: { inventory: { crackers: 2, 'water-bottle': 2 }, relationships: { 'chen-meng': -18 }, addFlags: ['community-looted'] } },
      { label: '把钥匙留给下一户', hint: '精神 +5，信任 +5', result: '你没有开门。至少今天，你相信还有“下一户”。', effects: { stats: { morale: 5 }, relationships: { 'chen-meng': 5 } } },
    ],
  },
  {
    id: 'courtyard-dog-1', title: '被拴住的黄狗', phase: 'survival', minDay: 1, maxDay: 5,
    text: '院里的黄狗还拴在自行车棚旁，水盆翻了。它没有叫，只盯着每一个经过的窗户。', chain: { id: 'courtyard-dog', step: 1 },
    options: [
      { label: '下楼放水并解开绳子', hint: '水 -1，体力 -5，精神 +5', result: '它喝完水，没有跟你上楼，转身钻进了小区深处。', requirements: [{ item: 'water-bottle', quantity: 1 }], effects: { inventory: { 'water-bottle': -1 }, stats: { stamina: -5, morale: 5 }, addFlags: ['dog-freed'] } },
      { label: '从窗户扔一块饼干', hint: '饼干 -1，精神 +2', result: '饼干落在够不着的地方。它最终还是拖着绳子够到了。', requirements: [{ item: 'crackers', quantity: 1 }], effects: { inventory: { crackers: -1 }, stats: { morale: 2 }, addFlags: ['dog-fed'] } },
      { label: '拉上窗帘', hint: '精神 -3', result: '你依然能听见铁链摩擦地面的声音。', effects: { stats: { morale: -3 } } },
    ],
  },
  {
    id: 'courtyard-dog-2', title: '门口的药盒', phase: 'survival', minDay: 4, maxDay: 9,
    text: '清晨，黄狗蹲在门外，嘴边放着一只磨花的药盒。楼下拐角传来陌生人的脚步。', chain: { id: 'courtyard-dog', step: 2 }, requiresFlags: ['dog-freed'],
    options: [
      { label: '收下药盒并让它进门', hint: '止痛片 +1，精神 +6', result: '它在门边趴下。你第一次觉得这间屋子不是只剩一个人。', effects: { inventory: { painkiller: 1 }, stats: { morale: 6 }, addFlags: ['dog-sheltered'] } },
      { label: '收下药盒，关门', hint: '止痛片 +1', result: '它在门外停了一会儿，又悄无声息地下楼。', effects: { inventory: { painkiller: 1 } } },
      { label: '不碰来路不明的东西', hint: '健康 +1', result: '谨慎让你避开风险，也让门外重新空了。', effects: { stats: { health: 1 } } },
    ],
  },
  {
    id: 'ledger-1', title: '五金店的欠账本', phase: 'survival', minDay: 3, maxDay: 7,
    text: '潘岳托人送来一本防水账簿。最后一页写着：变电站备用钥匙借给了“穿白外套的人”。', chain: { id: 'ledger', step: 1 }, npc: 'pan-yue',
    options: [
      { label: '替他保管账簿', hint: '潘岳信任 +12，情报 +1', result: '账页里夹着变电站值班表，周三夜里本应有人。', effects: { relationships: { 'pan-yue': 12 }, intel: 1, addFlags: ['ledger-kept'] } },
      { label: '问他用工具交换线索', hint: '多用钳 -1，情报 +2', result: '他把控制楼的备用入口画得很细。', requirements: [{ item: 'multitool', quantity: 1 }], effects: { inventory: { multitool: -1 }, intel: 2, relationships: { 'pan-yue': 6 }, addFlags: ['substation-route'] } },
      { label: '原样退回', hint: '无消耗', result: '潘岳只回了一句：“不欠人情也好。”' },
    ],
  },
  {
    id: 'ledger-2', title: '账本缺失的一页', phase: 'survival', minDay: 6, maxDay: 11,
    text: '你发现账本页码跳了一张。潘岳承认，那页记录了封锁前三天有人批量买走防化胶带和低温箱。', chain: { id: 'ledger', step: 2 }, npc: 'pan-yue', requiresFlags: ['ledger-kept'],
    options: [
      { label: '请他写下买家特征', hint: '情报 +1，证据 +1', result: '白色公务车、无牌低温箱、疾控旧工牌。三条线索连了起来。', effects: { intel: 1, relationships: { 'pan-yue': 8 }, addFlags: ['evidence-ledger'] } },
      { label: '把账簿当引火纸还给他', hint: '精神 +2，信任 -12', result: '他说你也许是对的，但还是把账本收了回去。', effects: { stats: { morale: 2 }, relationships: { 'pan-yue': -12 } } },
      { label: '先活过今晚再说', hint: '体力 +4', result: '线索不会喂饱人。你合上本子去休息。', effects: { stats: { stamina: 4 } } },
    ],
  },
  {
    id: 'horde-warning', title: '远处成片的脚步', phase: 'survival', minDay: 6, maxDay: 6, npc: 'chen-meng',
    text: '傍晚，封锁线方向传来连续的金属碰撞。陈檬在楼道里逐户提醒：两天内会有大批感染者沿主路移动。', chain: { id: 'horde', step: 1 },
    options: [
      { label: '用木板补住楼道窗', hint: '木板 -1，完整度 +10', result: '钉锤声把整栋楼都叫醒了。有人开始跟着加固自家门。', requirements: [{ item: 'wood-board', quantity: 1 }], effects: { inventory: { 'wood-board': -1 }, shelter: { integrity: 10, reinforcement: 1 }, addFlags: ['horde-prepared'] } },
      { label: '用钢板封住底层入口', hint: '薄钢板 -1，完整度 +18，加固 +2', result: '钢板压住了最薄弱的玻璃门。撞击会传进来，但不再直接落到门框上。', requirements: [{ item: 'metal-sheet', quantity: 1 }], effects: { inventory: { 'metal-sheet': -1 }, shelter: { integrity: 18, reinforcement: 2 }, addFlags: ['horde-prepared'] } },
      { label: '搬家具抵住门', hint: '体力 -14，完整度 +6', result: '柜子把过道堵得只剩一道缝。至少今晚能睡。', effects: { stats: { stamina: -14 }, shelter: { integrity: 6 }, addFlags: ['horde-braced'] } },
      { label: '把体力留给逃跑', hint: '精神 -5', result: '你把逃生包放到门边，却发现整栋楼没有真正的逃生路线。', effects: { stats: { morale: -5 } } },
    ],
  },
  {
    id: 'horde-night', title: '尸潮经过长街', phase: 'survival', minDay: 8, maxDay: 8,
    text: '凌晨两点，玻璃先开始发颤，随后是成百上千的脚步。它们撞上楼下卷闸门，像水挤进狭窄的管道。', chain: { id: 'horde', step: 2 },
    options: [
      { label: '守住楼梯口', hint: '危险：中；加固会降低损失', result: '你和邻居轮流顶住防火门，直到街上的声音移向北边。', danger: 42, effects: { shelter: { integrity: -12 }, stats: { stamina: -18 }, relationships: { 'chen-meng': 6 }, addFlags: ['horde-survived'] } },
      { label: '熄灯保持安静', hint: '电力 -1，精神 -8，完整度 -8', result: '有东西在门外停了很久。天亮时，门板上全是指甲抓出的白痕。', effects: { shelter: { power: -1, integrity: -8 }, stats: { morale: -8 }, addFlags: ['horde-survived'] } },
      { label: '从后窗引开它们', hint: '需要手电；危险：高', result: '光束把一部分脚步引向废弃停车场，也把你的位置暴露了几秒。', requirements: [{ item: 'flashlight', quantity: 1 }], danger: 58, effects: { stats: { stamina: -12 }, shelter: { integrity: -5 }, addFlags: ['horde-survived'] } },
    ],
  },

  {
    id: 'rain-barrels', title: '天台积水', phase: 'survival', minDay: 2, weather: ['暴雨', '酸雨'],
    text: '排水沟被塑料袋堵住，天台积了一层浑浊的水。水很宝贵，病也一样真实。',
    options: [
      { label: '用净水片和滤布处理', hint: '净水片 -1，滤布 -1，瓶装水 +3', result: '过滤后的水仍有一点炭味，但足够清澈。', requirements: [{ item: 'purifier-tablet', quantity: 1 }, { item: 'filter-cloth', quantity: 1 }], effects: { inventory: { 'purifier-tablet': -1, 'filter-cloth': -1, 'water-bottle': 3 } } },
      { label: '只收进水箱，暂不饮用', hint: '储水 +12', result: '你贴上“未处理”的纸条，避免在最渴的时候犯错。', effects: { shelter: { water: 12 } } },
      { label: '清理排水口', hint: '体力 -6，完整度 +3', result: '积水慢慢退去，屋顶暂时不会继续渗漏。', effects: { stats: { stamina: -6 }, shelter: { integrity: 3 } } },
    ],
  },
  {
    id: 'fridge-last-meal', title: '冰箱里的最后一顿', phase: 'survival', minDay: 1, maxDay: 3, npc: 'chen-meng',
    text: '停电后的冰箱越来越暖。里面还剩半盒鸡蛋和一把青菜，再放一天就只能丢掉。',
    options: [
      { label: '用燃料做一顿热饭', hint: '燃料 -3，饱腹 +20，精神 +8', result: '锅里冒出的热气让厨房短暂恢复了日常的样子。', requirements: [{ minStat: { stamina: 1 } }], effects: { shelter: { fuel: -3 }, stats: { satiety: 20, morale: 8 } } },
      { label: '分给同楼的人', hint: '陈檬信任 +10，精神 +4', result: '食物不多，每个人只分到一小口，但没人抱怨。', effects: { relationships: { 'chen-meng': 10 }, stats: { morale: 4 } } },
      { label: '扔掉变质部分', hint: '健康 +2', result: '垃圾袋系得很紧。你宁愿饿一点，也不想在这时腹泻。', effects: { stats: { health: 2 } } },
    ],
  },
  {
    id: 'balcony-fire', title: '对楼的阳台火', phase: 'survival', minDay: 3, npc: 'chen-meng',
    text: '对楼有人在阳台烧纸箱煮水，火舌已经舔到晾衣架。风正朝你这栋楼吹。',
    options: [
      { label: '大声提醒并协助灭火', hint: '水分 -8，体力 -8，精神 +4', result: '几盆水从不同窗口泼下去，火终于缩回铁桶。', effects: { stats: { hydration: -8, stamina: -8, morale: 4 }, relationships: { 'chen-meng': 4 } } },
      { label: '关窗并堵住通风口', hint: '胶带 -1，完整度 +2', result: '烟味还是钻进来，但没有火星。', requirements: [{ item: 'duct-tape', quantity: 1 }], effects: { inventory: { 'duct-tape': -1 }, shelter: { integrity: 2 } } },
      { label: '观察风向，暂不介入', hint: '精神 -2', result: '火最终被扑灭。你一直站在窗后。', effects: { stats: { morale: -2 } } },
    ],
  },
  {
    id: 'battery-trade', title: '隔门的交易', phase: 'survival', minDay: 3, npc: 'chen-meng',
    text: '一个陌生男人在楼道里逐户问：一组电池换两瓶水。他不肯摘下摩托车头盔。',
    options: [
      { label: '用两瓶水交换', hint: '水 -2，电池 +1', result: '交易从门缝完成。电池包装没拆过，是真的。', requirements: [{ item: 'water-bottle', quantity: 2 }], effects: { inventory: { 'water-bottle': -2, batteries: 1 } } },
      { label: '让他用电池证明收音机能响', hint: '情报 +1，危险：低', result: '他调到一个民用频道。里面有人在报东郊道路情况。', danger: 18, effects: { intel: 1 } },
      { label: '拒绝并提醒邻居', hint: '陈檬信任 +4', result: '他的脚步很快消失。陈檬把这件事写进楼层登记表。', effects: { relationships: { 'chen-meng': 4 } } },
    ],
  },
  {
    id: 'pipe-knock', title: '暖气管里的报码', phase: 'survival', minDay: 4,
    text: '停暖的管道传来有节奏的敲击：四下、停顿、两下。楼上有人在用最原始的方式找活人。',
    options: [
      { label: '照着节奏回应', hint: '精神 +5', result: '另一端很快回了三下。你们没有说话，但彼此都在。', effects: { stats: { morale: 5 }, addFlags: ['pipe-contact'] } },
      { label: '敲出求水信号', hint: '瓶装水 +1，欠下人情', result: '半小时后，一瓶水沿楼梯滚到门口，瓶身写着“12F”。', effects: { inventory: { 'water-bottle': 1 }, addFlags: ['owe-floor12'] } },
      { label: '不暴露位置', hint: '精神 -1', result: '敲击持续了几分钟，最终停了。', effects: { stats: { morale: -1 } } },
    ],
  },
  {
    id: 'medicine-request', title: '退烧药清单', phase: 'survival', minDay: 4,
    text: '林舟把一张手写清单塞进来：止痛片、净水、干净布。她说不是为一个人准备的。', npc: 'lin-zhou',
    options: [
      { label: '交出止痛片和绷带', hint: '药品 -2，林舟信任 +18', result: '她承诺下次外出会替你留意抗生素。', requirements: [{ item: 'painkiller', quantity: 1 }, { item: 'bandage', quantity: 1 }], effects: { inventory: { painkiller: -1, bandage: -1 }, relationships: { 'lin-zhou': 18 }, addFlags: ['clinic-supplied'] } },
      { label: '只提供一瓶水', hint: '水 -1，林舟信任 +6', result: '她收下水，说这已经能帮上忙。', requirements: [{ item: 'water-bottle', quantity: 1 }], effects: { inventory: { 'water-bottle': -1 }, relationships: { 'lin-zhou': 6 } } },
      { label: '说明自己无法支援', hint: '无消耗', result: '她点点头，没有追问你的库存。' },
    ],
  },
  {
    id: 'acid-rain-leak', title: '带铁锈味的漏水', phase: 'survival', minDay: 4, weather: ['酸雨'],
    text: '雨水从窗框渗进来，在地板上留下橙色痕迹。密封条已经发脆。',
    options: [
      { label: '用胶带和滤布封住', hint: '胶带 -1，滤布 -1，完整度 +8', result: '临时密封层不漂亮，但雨声被挡在外面。', requirements: [{ item: 'duct-tape', quantity: 1 }, { item: 'filter-cloth', quantity: 1 }], effects: { inventory: { 'duct-tape': -1, 'filter-cloth': -1 }, shelter: { integrity: 8 } } },
      { label: '穿雨衣从外侧处理', hint: '体力 -10，完整度 +5', result: '你贴着湿滑的外墙把排水槽复位。', requirements: [{ item: 'raincoat', quantity: 1 }], danger: 24, effects: { stats: { stamina: -10 }, shelter: { integrity: 5 } } },
      { label: '拿盆接住', hint: '完整度 -4，储水 +3', result: '盆里的水不能直接喝，至少没有漫进床底。', effects: { shelter: { integrity: -4, water: 3 } } },
    ],
  },
  {
    id: 'false-evacuation', title: '白色面包车', phase: 'survival', minDay: 5, npc: 'chen-meng',
    text: '一辆没有标识的白色面包车用喇叭喊“临时撤离”，要求每户只带身份证下楼。官方频道对此只字未提。',
    options: [
      { label: '记录车牌和行驶方向', hint: '情报 +1，证据 +1', result: '车牌尾号与征调药品的车辆登记一致。', effects: { intel: 1, addFlags: ['evidence-van'] } },
      { label: '在楼道提醒所有人别下去', hint: '精神 -3，陈檬信任 +8', result: '有人骂你多事，但最终没有一户开门。', effects: { stats: { morale: -3 }, relationships: { 'chen-meng': 8 } } },
      { label: '保持观察，不做判断', hint: '无消耗', result: '车等了十分钟，带走街对面两个提着行李的人。' },
    ],
  },
  {
    id: 'mold-wall', title: '墙角的霉斑', phase: 'survival', minDay: 5, weather: ['暴雨', '大雾'],
    text: '连续潮湿让储藏间墙角长出灰绿色霉斑，纸箱底部已经发软。',
    options: [
      { label: '用消毒液彻底清理', hint: '消毒液 -1，健康 +3', result: '刺鼻气味散去后，墙角终于干净。', requirements: [{ item: 'disinfectant', quantity: 1 }], effects: { inventory: { disinfectant: -1 }, stats: { health: 3 } } },
      { label: '移开物资并通风', hint: '体力 -7，完整度 -2', result: '你保住了纸箱里的东西，窗框却被湿气又泡开一点。', effects: { stats: { stamina: -7 }, shelter: { integrity: -2 } } },
      { label: '先用旧报纸盖住', hint: '健康 -3', result: '看不见不代表消失。第二天房间里都是霉味。', effects: { stats: { health: -3 }, injury: '呼吸道不适' } },
    ],
  },
  {
    id: 'roof-solar', title: '短暂的晴窗', phase: 'survival', minDay: 5, weather: ['晴冷'], npc: 'chen-meng',
    text: '云层裂开两个小时，阳光落在积灰的楼顶。所有能充电的东西都被摆到了窗边。',
    options: [
      { label: '架起折叠太阳能板', hint: '电力 +8', result: '电量缓慢爬升。很少有数字能让人这样安心。', requirements: [{ item: 'solar-charger', quantity: 1 }], effects: { shelter: { power: 8 } } },
      { label: '帮邻居轮流充应急灯', hint: '电力 +3，陈檬信任 +7', result: '一根接线板穿过三户门缝，谁都只充了半小时。', effects: { shelter: { power: 3 }, relationships: { 'chen-meng': 7 } } },
      { label: '晒干被褥和衣服', hint: '精神 +6，健康 +2', result: '太阳味只停留了一晚，也足够珍贵。', effects: { stats: { morale: 6, health: 2 } } },
    ],
  },
  {
    id: 'injured-stranger', title: '门外的血迹', phase: 'survival', minDay: 6,
    text: '楼道里有一道拖行的血迹，一个陌生女人靠着消防栓坐下。她神志清醒，手臂被玻璃划开。',
    options: [
      { label: '隔着手套替她包扎', hint: '绷带 -1，手套有利；精神 +5', result: '她来自东郊车队，临走告诉你调度室还有撤离名单。', requirements: [{ item: 'bandage', quantity: 1 }], danger: 20, effects: { inventory: { bandage: -1 }, stats: { morale: 5 }, intel: 1, addFlags: ['terminal-tip'] } },
      { label: '把绷带放在地上后退', hint: '绷带 -1，健康风险低', result: '她自己完成了包扎，向你点了点头。', requirements: [{ item: 'bandage', quantity: 1 }], effects: { inventory: { bandage: -1 }, stats: { morale: 2 } } },
      { label: '让她离开楼道', hint: '精神 -5', result: '她扶着墙慢慢下楼，血迹在转角消失。', effects: { stats: { morale: -5 } } },
    ],
  },
  {
    id: 'radio-choir', title: '频道里的合唱', phase: 'survival', minDay: 7,
    text: '民用频道里有人提议，每晚九点各唱一首歌，让独自守夜的人知道城里还有别人。',
    options: [
      { label: '打开窗缝跟着唱', hint: '精神 +9，可能暴露位置', result: '你的声音很轻，却在副歌时听见隔壁也加入了。', danger: 12, effects: { stats: { morale: 9 } } },
      { label: '只听不唱', hint: '精神 +5，电力 -1', result: '信号时断时续，没有一个人唱准拍子。', effects: { stats: { morale: 5 }, shelter: { power: -1 } } },
      { label: '保存电力', hint: '电力不变，精神 -1', result: '九点整，你想象城市里某些窗户正在亮着。', effects: { stats: { morale: -1 } } },
    ],
  },
  {
    id: 'fuel-smell', title: '楼下的汽油味', phase: 'survival', minDay: 7, npc: 'pan-yue',
    text: '一楼传来浓重汽油味。有人把燃料倒进饮料瓶，瓶盖已经被腐蚀发白。',
    options: [
      { label: '拿密封燃料罐帮忙转装', hint: '燃料 +4，潘岳信任 +4', result: '危险的塑料瓶被清空，对方分给你一点燃料。', requirements: [{ item: 'fuel-can', quantity: 1 }], effects: { shelter: { fuel: 4 }, relationships: { 'pan-yue': 4 } } },
      { label: '用沙土吸附泄漏', hint: '体力 -9，完整度 +2', result: '气味慢慢淡下去，楼道窗户开了一整晚。', effects: { stats: { stamina: -9 }, shelter: { integrity: 2 } } },
      { label: '封住自家门缝', hint: '胶带 -1，健康 +2', result: '胶带挡住气味，也把楼道里的争吵隔在外面。', requirements: [{ item: 'duct-tape', quantity: 1 }], effects: { inventory: { 'duct-tape': -1 }, stats: { health: 2 } } },
      { label: '远离一楼', hint: '完整度 -3', result: '没人处理泄漏。挥发的燃料让门框表面起了一层泡。', effects: { shelter: { integrity: -3 } } },
    ],
  },
  {
    id: 'cold-snap', title: '室内结霜', phase: 'survival', minDay: 7, weather: ['寒潮'],
    text: '清晨，窗内侧结了一圈白霜。呼出的气在房间里清晰可见。',
    options: [
      { label: '点燃炉头取暖并煮面', hint: '燃料 -3，方便面 -1，饱腹 +28，精神 +5', requirements: [{ item: 'instant-noodles', quantity: 1 }, { item: 'camp-stove', quantity: 1 }], result: '热汤把手指从麻木里叫回来。', effects: { inventory: { 'instant-noodles': -1 }, shelter: { fuel: -3 }, stats: { satiety: 28, morale: 5, health: 2 } } },
      { label: '封窗、集中到小房间', hint: '体力 -5，健康 -2', result: '你把所有毯子铺在一张床上，勉强守住体温。', effects: { stats: { stamina: -5, health: -2 } } },
      { label: '做一组原地运动', hint: '体力 -12，健康 +1', result: '心跳快起来，至少暂时不再发抖。', effects: { stats: { stamina: -12, health: 1 } } },
    ],
  },
  {
    id: 'door-scratches', title: '门板上的新抓痕', phase: 'survival', minDay: 9,
    text: '门外没有脚步，但门板下沿多了几道新鲜抓痕。猫眼被什么东西糊住了。',
    options: [
      { label: '用工具拆开猫眼检查', hint: '需要工具；完整度 +3', result: '糊住猫眼的是一块沾泥的布，门外已经空了。', requirements: [{ item: 'toolkit', quantity: 1 }], effects: { shelter: { integrity: 3 }, intel: 1 } },
      { label: '不开门，守到天亮', hint: '体力 -10，精神 -4', result: '你握着撬棍坐了一夜。门外再没响过。', effects: { stats: { stamina: -10, morale: -4 } } },
      { label: '敲门制造有人值守的动静', hint: '危险：中', result: '楼梯间传来急促离开的脚步，不像感染者。', danger: 34, effects: { stats: { morale: -2 }, addFlags: ['looter-warned'] } },
    ],
  },
  {
    id: 'supply-drone', title: '坠落的配送无人机', phase: 'survival', minDay: 9, npc: 'lin-zhou',
    text: '一架小型配送无人机撞上对楼空调架，挂在两栋楼之间的电缆上。透明货舱里看得见药盒。',
    options: [
      { label: '用绳子从天台勾回来', hint: '需要绳子；危险：中；药品 +2', requirements: [{ item: 'rope', quantity: 1 }], danger: 35, result: '绳结在第三次才套住机臂。货舱里有绷带和抗生素。', effects: { inventory: { bandage: 1, antibiotics: 1 }, stats: { stamina: -8 } } },
      { label: '通知林舟来想办法', hint: '林舟信任 +10，绷带 +1', result: '她带来更长的晾衣杆，药品对半分。', effects: { relationships: { 'lin-zhou': 10 }, inventory: { bandage: 1 } } },
      { label: '别为看得见的东西冒险', hint: '精神 +1', result: '夜里一阵风把无人机吹落到街上，很快有人捡走。', effects: { stats: { morale: 1 } } },
    ],
  },
  {
    id: 'quiet-floor', title: '十二楼不再回应', phase: 'survival', minDay: 10,
    text: '暖气管里已经两天没有传来敲击。十二楼门口却摆着一袋分装好的物资。',
    options: [
      { label: '取走自己需要的一份', hint: '食物 +1，水 +1，精神 -2', result: '袋子里每份都一样。没人知道是谁最后分装的。', effects: { inventory: { crackers: 1, 'water-bottle': 1 }, stats: { morale: -2 } } },
      { label: '先敲门确认', hint: '危险：中，情报 +1', result: '门没开。你从屋内听见收音机仍在播放循环通知。', danger: 32, effects: { intel: 1, stats: { morale: -3 } } },
      { label: '把物资留在原地', hint: '精神 +3', result: '下一次上楼时，袋子已经空了。至少有人用上了。', effects: { stats: { morale: 3 } } },
    ],
  },
  {
    id: 'checkpoint-flare', title: '封锁线外的信号弹', phase: 'survival', minDay: 11, npc: 'qiu-lan',
    text: '东边升起一枚橙色信号弹。广播说那是撤离通道测试，邱岚的频率却反复警告“不要去东门”。',
    options: [
      { label: '相信邱岚，记录信号时刻', hint: '邱岚信任 +8，情报 +1', result: '十分钟后，东边传来车辆急刹和人群骚动。', effects: { relationships: { 'qiu-lan': 8 }, intel: 1, addFlags: ['evidence-flare'] } },
      { label: '相信官方，准备轻装撤离', hint: '精神 +3', result: '你把包放到门口，但一直没听见第二次通知。', effects: { stats: { morale: 3 }, addFlags: ['trusted-checkpoint'] } },
      { label: '哪边都不信', hint: '精神 -2', result: '互相矛盾的声音比沉默更让人疲惫。', effects: { stats: { morale: -2 } } },
    ],
  },
  {
    id: 'shared-dinner', title: '走廊里的晚饭', phase: 'survival', minDay: 11, npc: 'chen-meng',
    text: '陈檬提议把快过期的东西集中起来，在走廊尽头用一只锅煮掉。门仍各自关着，只留一条缝。',
    options: [
      { label: '贡献一份米和燃料', hint: '米砖 -1，燃料 -3，精神 +12，全员信任 +4', requirements: [{ item: 'rice', quantity: 1 }], result: '锅里只有米、豆子和盐，却是封锁以来最像一顿饭的晚饭。', effects: { inventory: { rice: -1 }, shelter: { fuel: -3 }, stats: { morale: 12, satiety: 18 }, relationships: { 'lin-zhou': 4, 'pan-yue': 4, 'qiu-lan': 4, 'chen-meng': 4 } } },
      { label: '贡献两份罐头', hint: '罐头 -2，精神 +8', requirements: [{ item: 'canned-beans', quantity: 2 }], result: '罐头里的豆子让锅里终于有了些内容。', effects: { inventory: { 'canned-beans': -2 }, stats: { morale: 8, satiety: 12 }, relationships: { 'chen-meng': 6 } } },
      { label: '只参加，不取食', hint: '精神 +4', result: '你听大家讲了几件封锁前的琐事，然后端着空碗回家。', effects: { stats: { morale: 4 } } },
    ],
  },
  {
    id: 'pump-restart', title: '停在半层的水压', phase: 'survival', minDay: 2, maxDay: 8,
    text: '厨房水龙头忽然吐出几口带锈味的水。楼顶水箱还有存量，但地下泵房的控制器只接受一次远程重启。',
    options: [
      { label: '用备用电力重启水泵', hint: '电力 -4，储水 +14', result: '水压维持了十一分钟。你接满所有标过日期的容器，随后立刻关闭总阀。', effects: { shelter: { power: -4, water: 14 }, addFlags: ['pump-restarted'] } },
      { label: '只接自家管道残水', hint: '储水 +5，精神 -3', result: '楼上的人还在拧水龙头时，你已经把自家阀门关上。', effects: { shelter: { water: 5 }, stats: { morale: -3 }, addFlags: ['pump-kept-private'] } },
      { label: '不碰来历不明的水', hint: '健康 +2', result: '水很快重新断掉。桶是空的，但你避开了一次可能的污染。', effects: { stats: { health: 2 } } },
    ],
  },
  {
    id: 'sealed-cartons', title: '封条完整的纸箱', phase: 'survival', minDay: 3, maxDay: 9,
    text: '消防通道堆着三只印有社区配送字样的纸箱。签收单被撕走，封条上却写着“隔离户优先”。',
    options: [
      { label: '拆一箱留下基本用品', hint: '口罩 +1，消毒液 +1，精神 -4', result: '箱里每份物资都贴着门牌。你只撕掉了其中一张标签。', effects: { inventory: { masks: 1, disinfectant: 1 }, stats: { morale: -4 }, addFlags: ['opened-relief-box'] } },
      { label: '按门牌逐户放到门口', hint: '体力 -10，精神 +7', result: '你没有敲门，只把纸箱分完。回程时，有人在门后轻轻说了声谢谢。', effects: { stats: { stamina: -10, morale: 7 }, addFlags: ['delivered-relief-boxes'] } },
      { label: '原地封住消防通道', hint: '完整度 +3', result: '你用废桌挡住入口，至少不会有人借着物资箱逐户试门。', effects: { shelter: { integrity: 3 } } },
    ],
  },
  {
    id: 'clinic-freezer-alarm', title: '诊所冷柜的报警短信', phase: 'survival', minDay: 4, maxDay: 10,
    text: '一条延迟发送的设备短信抵达手机：青禾诊所药品冷柜将在四十分钟后失温。短信里附着一次性门锁码。',
    options: [
      { label: '带移动电源赶去保住药品', hint: '电力 -5，危险：中，抗生素 +1', result: '你只带走一盒临期药，其余冷柜重新开始降温。至少后来的人还能用。', danger: 34, effects: { shelter: { power: -5 }, inventory: { antibiotics: 1 }, stats: { stamina: -8 }, addFlags: ['clinic-freezer-saved'] } },
      { label: '拆下冷柜备用电池', hint: '电池 +2，精神 -5', result: '报警声停了。你带走两组电池，柜门内侧很快蒙上一层水汽。', effects: { inventory: { batteries: 2 }, stats: { morale: -5 }, addFlags: ['clinic-freezer-stripped'] } },
      { label: '删除短信，不冒险出门', hint: '体力 +4', result: '四十分钟后，设备又发来最后一条失温通知，随后彻底离线。', effects: { stats: { stamina: 4 } } },
    ],
  },
  {
    id: 'quarantine-list', title: '贴错楼栋的隔离名单', phase: 'survival', minDay: 5, maxDay: 11,
    text: '风把一张盖章名单吹到阳台。上面记录的是隔壁楼被带走的住户，症状栏有几处明显后补的笔迹。',
    options: [
      { label: '拍照并记录涂改位置', hint: '情报 +2，精神 -4，留下证据', result: '照片放大后能看出两种墨水。你把原件压进防水袋。', effects: { intel: 2, stats: { morale: -4 }, addFlags: ['evidence-quarantine-list'] } },
      { label: '把名单送回隔壁楼', hint: '体力 -8，精神 +5', result: '门缝后伸出一只手接走名单。对方说，他们一直不知道家人被带去了哪里。', effects: { stats: { stamina: -8, morale: 5 }, addFlags: ['returned-quarantine-list'] } },
      { label: '烧掉名单取一点暖', hint: '精神 +2，燃料 +1', result: '盖章的纸卷曲发黑，只暖了几分钟。你决定不再替陌生人的名字负责。', effects: { stats: { morale: 2 }, shelter: { fuel: 1 } } },
    ],
  },
  {
    id: 'basement-signal', title: '地下室的敲击', phase: 'survival', minDay: 6, maxDay: 12,
    text: '一楼配电间下方传来规律敲击。地下储藏室可能困着人，也可能只是松动的管道被水流撞击。',
    options: [
      { label: '带工具下去确认', hint: '需要工具箱，危险：高；燃料 +5', result: '里面没有人，只有一只被倒塌货架卡住的应急油桶。你拖着它爬回地面。', requirements: [{ item: 'toolkit', quantity: 1 }], danger: 48, effects: { shelter: { fuel: 5 }, stats: { stamina: -12 }, addFlags: ['basement-checked'] } },
      { label: '隔门按原节奏回应', hint: '精神 +4，情报 +1', result: '敲击停了一分钟，然后改成了三短一长。无论下面是什么，它听见了你。', effects: { stats: { morale: 4 }, intel: 1, addFlags: ['basement-replied'] } },
      { label: '用木板封住地下室门', hint: '木板 -1，完整度 +8', result: '最后一颗钉子敲下去后，声音仍持续了很久。', requirements: [{ item: 'wood-board', quantity: 1 }], effects: { inventory: { 'wood-board': -1 }, shelter: { integrity: 8 }, stats: { morale: -3 } } },
      { label: '远离一楼', hint: '精神 -2', result: '到后半夜，敲击自己停了。你没有下楼确认原因。', effects: { stats: { morale: -2 } } },
    ],
  },
  {
    id: 'roof-beacon', title: '楼顶的求救灯', phase: 'survival', minDay: 7, maxDay: 13,
    text: '对街楼顶有人用应急灯打出求救信号。他们缺水，却愿意交换一卷未拆封的防水布和一节电池。',
    options: [
      { label: '用绳索送过去两瓶水', hint: '水 -2，绳索不消耗；电池 +1，完整度 +5', result: '装水的袋子沿晾衣绳滑过街面。回来的包里有电池和一块能补窗的防水布。', requirements: [{ item: 'rope', quantity: 1 }, { item: 'water-bottle', quantity: 2 }], danger: 26, effects: { inventory: { 'water-bottle': -2, batteries: 1 }, shelter: { integrity: 5 }, stats: { morale: 6 }, addFlags: ['roof-trade-complete'] } },
      { label: '只回复这里也缺水', hint: '精神 +2', result: '对面熄灯前回了一个“明白”。至少没人会继续浪费电等你。', effects: { stats: { morale: 2 } } },
      { label: '保持熄灯，避免暴露', hint: '危险降低，精神 -4', result: '求救灯又闪了半小时。第二天，那座楼顶再没有亮过。', effects: { stats: { morale: -4 }, addFlags: ['ignored-roof-beacon'] } },
    ],
  },
  {
    id: 'final-broadcast-window', title: '广播静默前的窗口', phase: 'survival', minDay: 8,
    text: '邱岚说城市的民用中继将在两天后彻底停机。若要把证据发到封锁线外，只剩一次稳定窗口。', npc: 'qiu-lan',
    options: [
      { label: '承诺协助发送', hint: '开启一次外联发送窗口', result: '她把发送步骤拆成六行短句，每一步都可能是最后一步。', requirements: [{ minIntel: 3 }], effects: { relationships: { 'qiu-lan': 8 }, addFlags: ['truth-window-open'] } },
      { label: '先问普通撤离安排', hint: '情报 +1', result: '她确认西侧会在既定撤离日开放人行通道，但名额不看证据。', effects: { intel: 1, addFlags: ['west-evac-known'] } },
      { label: '不再承担额外风险', hint: '精神 +5', result: '你决定把力气留给活下去。这不是错误答案。', effects: { stats: { morale: 5 } } },
    ],
  },
  {
    id: 'night-silence', title: '全城静默', phase: 'survival', minDay: 12,
    text: '这一夜没有警报、没有车辆，也没有远处的喊声。彻底的安静反而让每一次水管收缩都像敲门。',
    options: [
      { label: '点一支蜡烛守夜', hint: '蜡烛 -1，精神 +6', requirements: [{ item: 'candles', quantity: 1 }], result: '小小的火焰把屋子缩成一块可以守住的地方。', effects: { inventory: { candles: -1 }, stats: { morale: 6 } } },
      { label: '和邻居隔门说话', hint: '精神 +5，随机邻里信任 +3', result: '你们聊了停电前楼下新开的面馆，谁也没提明天。', effects: { stats: { morale: 5 }, relationships: { 'chen-meng': 3 } } },
      { label: '强迫自己睡觉', hint: '体力 +10，精神 -2', result: '睡眠断成很多小段，但身体总算得到休息。', effects: { stats: { stamina: 10, morale: -2 } } },
    ],
  },
];

export const EVENT_MAP: Record<string, GameEvent> = Object.fromEntries(
  EVENTS.map((event) => [event.id, event]),
);
