import type { EventEffect, ExplorationSkillId } from '../types.ts';
import { ADDITIONAL_DEEP_LOCATIONS } from './deep-additional-locations.ts';

export interface DeepOptionRequirement {
  item?: string;
  quantity?: number;
  skill?: ExplorationSkillId;
  minSkill?: number;
  minIntel?: number;
  flag?: string;
}

export interface DeepTargetOption {
  id: string;
  label: string;
  hint: string;
  result: string;
  minutes: number;
  stamina: number;
  requirements?: DeepOptionRequirement[];
  consumes?: Record<string, number>;
  loot?: Record<string, number>;
  /**
   * Progression loot is never removed by difficulty scarcity. It is also
   * capacity-checked before the option can be committed, so a full backpack
   * cannot permanently destroy a one-off story route.
   */
  guaranteedLoot?: string[];
  skillXp?: Partial<Record<ExplorationSkillId, number>>;
  danger?: number;
  addFlags?: string[];
  effects?: EventEffect;
}

export interface DeepTarget {
  id: string;
  name: string;
  observation: string;
  resolvedByFlag?: string;
  options: DeepTargetOption[];
}

export interface DeepScene {
  id: string;
  name: string;
  text: string;
  connections: string[];
  targets: DeepTarget[];
}

export interface DeepLocation {
  id: string;
  name: string;
  entrance: string;
  travelMinutes: number;
  returnMinutes: number;
  approachRisk: number;
  scenes: DeepScene[];
}

export const RIVERSIDE_MARKET: DeepLocation = {
  id: 'riverside-market',
  name: '河西生活超市',
  entrance: 'entrance',
  travelMinutes: 60,
  returnMinutes: 60,
  approachRisk: 14,
  scenes: [
    {
      id: 'entrance', name: '入口与主通道', connections: ['checkout', 'food', 'household'],
      text: '自动门停在半开的角度，一辆购物车横在门缝里。促销吊旗还写着“本周会员日”，下面却只剩被鞋印踩烂的价签。左边是收银区，直走通往食品货架，右侧的生活用品区被倒下的展架挡住一半。',
      targets: [{
        id: 'service-desk', name: '服务台失物抽屉', observation: '透明抽屉后压着一串编号牌和一张员工交接单。抽屉锁很薄，但台面上的玻璃已经裂开，动静稍大就会整块落下。',
        options: [
          { id: 'pick', label: '用薄片开锁组拨开锁舌', hint: '35分钟 · 体力 -3 · 开锁经验 +2 · 安静', result: '锁舌在第三次回弹时让开。交接单背面画着库房钥匙的存放位置。', minutes: 35, stamina: 3, requirements: [{ item: 'lockpick-set' }], loot: { batteries: 1 }, skillXp: { lockpicking: 2 }, addFlags: ['market-key-clue'] },
          { id: 'crowbar', label: '用撬棍别开抽屉', hint: '20分钟 · 体力 -7 · 工具经验 +1 · 可能招来动静', result: '抽屉连着一截塑料边框脱落。玻璃碎片滚进柜台深处，声音在空店里走得很远。', minutes: 20, stamina: 7, requirements: [{ item: 'crowbar' }], loot: { batteries: 1 }, skillXp: { toolUse: 1 }, danger: 16 },
          { id: 'search', label: '先检查柜台周围', hint: '25分钟 · 体力 -2 · 搜寻经验 +1 · 情报 ≥ 1', result: '你没有碰锁，而是顺着交接单上的编号找到掉在踢脚线后的备用抽屉钥匙。', minutes: 25, stamina: 2, requirements: [{ minIntel: 1 }], loot: { batteries: 1 }, skillXp: { search: 1 }, addFlags: ['market-key-clue'] },
        ],
      }],
    },
    {
      id: 'checkout', name: '收银台', connections: ['entrance', 'toilet'],
      text: '六条结账通道里只有一台应急屏幕还在闪。传送带上散着口香糖、退货小票和一只没来得及装袋的保温杯。最里面的烟酒柜被卷帘锁住，收银员通道后方有一扇“员工区域”小门。',
      targets: [{
        id: 'cashier-cage', name: '烟酒柜下层货格', observation: '卷帘底部有撬痕，但锁芯没坏。透过孔洞能看见电池、巧克力和几包被遗忘的高价零食。',
        options: [
          { id: 'pick', label: '尝试开锁', hint: '50分钟 · 体力 -5 · 需要开锁 1级、情报 ≥ 2 · 收获完整', result: '你根据锁芯磨损调整薄片角度，卷帘只发出一声轻响。里面的东西没有被砸坏。', minutes: 50, stamina: 5, requirements: [{ item: 'lockpick-set' }, { skill: 'lockpicking', minSkill: 1 }, { minIntel: 2 }], loot: { batteries: 2, chocolate: 2, 'instant-coffee': 1 }, skillXp: { lockpicking: 2 } },
          { id: 'crowbar', label: '从底部用撬棍抬起', hint: '30分钟 · 体力 -10 · 工具经验 +2 · 风险较高', result: '金属帘被扭出一道能伸手的缝。几盒东西压坏了，你仍够到一部分物资。', minutes: 30, stamina: 10, requirements: [{ item: 'crowbar' }], loot: { batteries: 1, chocolate: 1 }, skillXp: { toolUse: 2 }, danger: 24 },
          { id: 'disassemble', label: '拆下卷帘侧轨', hint: '65分钟 · 体力 -7 · 需要工具箱 · 可回收材料', result: '你按螺丝受力顺序卸下侧轨。速度不快，但锁和金属条都完整保留下来。', minutes: 65, stamina: 7, requirements: [{ item: 'toolkit' }], loot: { batteries: 1, chocolate: 1, 'metal-scrap': 2 }, skillXp: { toolUse: 2 } },
        ],
      }],
    },
    {
      id: 'food', name: '食品区', connections: ['entrance', 'cold-storage', 'warehouse'],
      text: '方便食品货架像被潮水推过，只剩最上层和托盘底部还有东西。地上黏着糖浆，鞋底每一步都会发出短促的撕裂声。冷藏区在北侧，后仓卷帘门藏在一排空纸箱后。',
      targets: [{
        id: 'high-pallet', name: '高层托盘笼', observation: '一只缠膜托盘卡在货架顶层，里面有罐头和脱水菜。直接攀爬会省工具，但货架的后脚已经变形。',
        options: [
          { id: 'multitool', label: '用多用钳剪开缠膜并逐件放下', hint: '45分钟 · 体力 -6 · 工具经验 +1', result: '你把缠膜割成可控的窄条，物资一件件滑进购物篮，没有砸到地上。', minutes: 45, stamina: 6, requirements: [{ item: 'multitool' }], loot: { 'canned-beans': 2, 'dried-vegetables': 2 }, skillXp: { toolUse: 1 } },
          { id: 'climb', label: '踩购物车爬上去', hint: '25分钟 · 体力 -12 · 搜寻经验 +2 · 有坠落风险', result: '购物车轮子在你脚下慢慢转动。你只来得及抱下一部分，落地时肩膀撞上了货架。', minutes: 25, stamina: 12, loot: { 'canned-beans': 1, 'dried-vegetables': 1 }, skillXp: { search: 2 }, danger: 28 },
        ],
      }],
    },
    {
      id: 'household', name: '生活用品区', connections: ['entrance', 'toilet', 'warehouse'],
      text: '洗衣液漏了一地，空气里全是过甜的香味。纸品货架已经空了，五金角的铁网柜却还关着。柜后墙面有新鲜刮痕，像有人试过把整面网片卸走。',
      targets: [{
        id: 'hardware-cage', name: '上锁的五金货柜', observation: '铁网后能看见胶带、手套和几卷铜线。挂锁厚，但合页只是普通十字螺丝；硬砍更快，也更耗体力。',
        options: [
          { id: 'hatchet', label: '用短柄手斧砍断薄合页', hint: '25分钟 · 体力 -13 · 工具经验 +2 · 噪声风险', result: '第三斧让薄铁皮向内卷起。刃口多了缺口，但货柜终于张开。', minutes: 25, stamina: 13, requirements: [{ item: 'hatchet' }], loot: { 'duct-tape': 2, gloves: 1, 'metal-scrap': 1 }, skillXp: { toolUse: 2 }, danger: 27 },
          { id: 'toolkit', label: '用工具箱拆下合页', hint: '60分钟 · 体力 -7 · 工具经验 +2 · 额外获得铜线', result: '锈死的最后一颗螺丝花了很久。网门完整卸下，你也保住了压在后面的铜线。', minutes: 60, stamina: 7, requirements: [{ item: 'toolkit' }], loot: { 'duct-tape': 2, gloves: 1, 'copper-wire': 1 }, skillXp: { toolUse: 2 } },
          { id: 'pick', label: '处理挂锁', hint: '45分钟 · 体力 -4 · 需要开锁 2级 · 安静且完整', result: '锁芯比看上去更旧。你避开一枚卡死的弹子，网门在没有破坏的情况下打开。', minutes: 45, stamina: 4, requirements: [{ item: 'lockpick-set' }, { skill: 'lockpicking', minSkill: 2 }], loot: { 'duct-tape': 2, gloves: 1, 'copper-wire': 1 }, skillXp: { lockpicking: 2 } },
        ],
      }],
    },
    {
      id: 'cold-storage', name: '冷藏区', connections: ['food', 'warehouse'],
      text: '冷柜玻璃蒙着一层灰白水汽，温度已经接近室温。角落的冷库门没有完全合拢，门缝里吹出的气流仍比店里凉。应急配电箱亮着一枚橙灯，说明某条备用回路还活着。',
      targets: [{
        id: 'cold-room', name: '卡住的冷库门', observation: '门后可能还有没完全解冻的食材。门轴被膨胀的密封条卡死；也可以先恢复短时供电，让电磁锁自行复位。',
        options: [
          { id: 'power', label: '检修应急回路后复位门锁', hint: '70分钟 · 体力 -8 · 工具经验 +3 · 情报 ≥ 2 · 获得较多鲜货', result: '压缩机低低地震了一下，电磁锁恢复到解锁位置。冷库最里面的几袋食物还保持着硬芯。', minutes: 70, stamina: 8, requirements: [{ item: 'toolkit' }, { minIntel: 2 }], loot: { 'frozen-dumplings': 2, potatoes: 1, 'juice-box': 2 }, skillXp: { toolUse: 3 } },
          { id: 'crowbar', label: '用撬棍撑开门缝', hint: '35分钟 · 体力 -11 · 工具经验 +2 · 鲜货较少', result: '密封条在拉扯中断裂。门开了，但靠外的食品已经温热，只能挑出少量尚可带走的。', minutes: 35, stamina: 11, requirements: [{ item: 'crowbar' }], loot: { 'frozen-dumplings': 1, 'juice-box': 1 }, skillXp: { toolUse: 2 }, danger: 14 },
        ],
      }],
    },
    {
      id: 'toilet', name: '厕所与员工走廊', connections: ['checkout', 'household', 'warehouse'],
      text: '感应灯早已失效。洗手台下摆着半桶浑水，镜子上有人用口红写了“钥匙不在办公室”。员工走廊尽头的消防图被撕掉一角，男厕最后一个水箱盖没有放正。',
      targets: [{
        id: 'cistern', name: '错位的水箱盖', observation: '盖子下压着一只密封袋。它不像遗失物，更像有人匆忙留下的交接。',
        options: [
          { id: 'inspect', label: '戴上手套仔细检查', hint: '25分钟 · 体力 -3 · 搜寻经验 +2 · 获得后仓钥匙', result: '密封袋里是后仓铜钥匙和一张手写便条：“别走装卸口，外面有人等。”', minutes: 25, stamina: 3, requirements: [{ item: 'gloves' }], loot: { 'warehouse-key': 1 }, skillXp: { search: 2 }, addFlags: ['market-warning'] },
          { id: 'barehand', label: '徒手取出密封袋', hint: '15分钟 · 体力 -2 · 有卫生风险', result: '袋子没有漏，但水箱边缘的碎瓷划过指节。里面确实是一把后仓钥匙。', minutes: 15, stamina: 2, loot: { 'warehouse-key': 1 }, skillXp: { search: 1 }, danger: 18, addFlags: ['market-warning'] },
        ],
      }, {
        id: 'maintenance-locker', name: '保洁工具间', observation: '窄门上的廉价锁芯已经生锈，门框也不结实。里面露出拖把杆和一小截软管；这把锁很适合用来练习基本手感。',
        options: [
          { id: 'practice-pick', label: '用薄片开锁组慢慢练习', hint: '55分钟 · 体力 -4 · 无等级要求 · 开锁经验 +3', result: '前两次你把弹子顶得太高。第三次减轻手劲后，锁芯终于顺着张力转过半圈。', minutes: 55, stamina: 4, requirements: [{ item: 'lockpick-set' }], loot: { 'filter-cloth': 1 }, skillXp: { lockpicking: 3 } },
          { id: 'multitool', label: '用多用钳卸掉门把', hint: '35分钟 · 体力 -6 · 工具经验 +1', result: '门把里的方轴被一点点抽出，锁舌失去支撑缩回门内。', minutes: 35, stamina: 6, requirements: [{ item: 'multitool' }], loot: { 'filter-cloth': 1 }, skillXp: { toolUse: 1 } },
        ],
      }],
    },
    {
      id: 'warehouse', name: '后仓与装卸口', connections: ['food', 'household', 'cold-storage', 'toilet'],
      text: '后仓比卖场安静得反常。成排托盘留下规整的空印，说明封锁前有人系统地搬走了大部分库存。办公室铁门仍锁着，门缝下露出半张印着车牌号的调拨单。装卸卷帘外偶尔传来金属碰撞。',
      targets: [{
        id: 'office', name: '后仓办公室铁门', observation: '这扇门保护的不像普通商品。铜钥匙孔、加固门框和地上的纸页都说明里面有人不想公开的记录。',
        options: [
          { id: 'key', label: '使用后仓铜钥匙', hint: '15分钟 · 体力 -2 · 最安静 · 钥匙保留', result: '钥匙转动得很顺，仿佛昨天还有人用过。桌上摊着封锁前三天的异常调拨记录，抽屉里有一张被折过多次的家庭照片。', minutes: 15, stamina: 2, requirements: [{ item: 'warehouse-key' }], loot: { 'family-photo': 1, 'canned-beans': 2, 'sealed-letter': 1 }, skillXp: { search: 2 }, addFlags: ['evidence-ledger'] },
          { id: 'pick', label: '精细开启办公室门锁', hint: '75分钟 · 体力 -7 · 需要开锁 3级、情报 ≥ 3', result: '你在最后一枚弹子上停了很久。锁开时没有留下明显痕迹，桌上的调拨记录也没有被破坏。', minutes: 75, stamina: 7, requirements: [{ item: 'lockpick-set' }, { skill: 'lockpicking', minSkill: 3 }, { minIntel: 3 }], loot: { 'family-photo': 1, 'canned-beans': 2, 'sealed-letter': 1 }, skillXp: { lockpicking: 3 }, addFlags: ['evidence-ledger'] },
          { id: 'breach', label: '用撬棍和手斧强行破门', hint: '40分钟 · 体力 -18 · 需两件工具 · 高噪声', result: '门框最终向里折断。你抢在装卸口的动静靠近前拿走桌面物资，但部分文件被震落的水管泡湿。', minutes: 40, stamina: 18, requirements: [{ item: 'crowbar' }, { item: 'hatchet' }], loot: { 'family-photo': 1, 'canned-beans': 1 }, skillXp: { toolUse: 3 }, danger: 38, addFlags: ['evidence-ledger'] },
        ],
      }],
    },
  ],
};

export const DEEP_LOCATIONS: Record<string, DeepLocation> = {
  [RIVERSIDE_MARKET.id]: RIVERSIDE_MARKET,
  ...Object.fromEntries(ADDITIONAL_DEEP_LOCATIONS.map((location) => [location.id, location])),
};

export function deepScene(locationId: string, sceneId: string): DeepScene | undefined {
  return DEEP_LOCATIONS[locationId]?.scenes.find((scene) => scene.id === sceneId);
}

export function deepTargetFlag(locationId: string, targetId: string): string {
  return `deep:${locationId}:${targetId}`;
}
