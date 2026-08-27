import type { EventEffect, Requirement } from '../types.ts';

export type ContactNpcId = 'chen-meng' | 'lin-zhou' | 'qiu-lan' | 'pan-yue';

export interface ContactOptionDefinition {
  id: string;
  label: string;
  hint: string;
  result: string;
  requirements?: Requirement[];
  effects?: EventEffect;
}

export interface ContactDefinition {
  npcId: ContactNpcId;
  channel: string;
  options: ContactOptionDefinition[];
  allianceResult: string;
}

export const CONTACTS: ContactDefinition[] = [
  {
    npcId: 'chen-meng', channel: '社区楼栋频道', allianceResult: '陈檬把你的门牌写进核心值守表。从今晚起，楼栋警戒、换班和敲管示警都会把你的避难所算在协防范围内。',
    options: [
      { id: 'consult', label: '询问楼栋与街面情况', hint: '情报 +1，精神 +2，信任 +2', result: '陈檬按楼层报出安全通道、缺口和仍有人回应的门牌。你第一次看见这栋楼作为一个整体如何活着。', effects: { intel: 1, stats: { morale: 2 }, relationships: { 'chen-meng': 2 } } },
      { id: 'support', label: '主动提供一瓶公共用水', hint: '瓶装水 -1，信任 +7，精神 +3', result: '她没有把水留给自己，而是在值守表旁标明分配顺序。你的名字被移到“可信联络”一栏。', requirements: [{ item: 'water-bottle', quantity: 1 }], effects: { inventory: { 'water-bottle': -1 }, relationships: { 'chen-meng': 7 }, stats: { morale: 3 } } },
    ],
  },
  {
    npcId: 'lin-zhou', channel: '诊疗短频', allianceResult: '林舟答应把你纳入每日伤情复核。她会在夜间恶化前提醒处理顺序，并为你保留一次真正紧急时的远程指导。',
    options: [
      { id: 'consult', label: '请她远程检查当前状态', hint: '健康 +3，精神 +2，信任 +2', result: '她让你依次检查体温、伤口边缘和呼吸频率，并纠正了两处容易忽略的处理细节。', effects: { stats: { health: 3, morale: 2 }, relationships: { 'lin-zhou': 2 } } },
      { id: 'support', label: '给临时救护点送一卷绷带', hint: '绷带 -1，信任 +8，精神 +3', result: '绷带被拆成数份。林舟报回每一份用在了谁身上，没有把你的支援简化成一句谢谢。', requirements: [{ item: 'bandage', quantity: 1 }], effects: { inventory: { bandage: -1 }, relationships: { 'lin-zhou': 8 }, stats: { morale: 3 } } },
    ],
  },
  {
    npcId: 'qiu-lan', channel: '九十七点三兆赫', allianceResult: '邱岚交给你一套固定的风险校验表。此后每次外出或危险操作前，她都会用已知病例、天气和道路数据替你复核一次。',
    options: [
      { id: 'consult', label: '核对感染与封锁记录', hint: '情报 +2，信任 +2', result: '邱岚把三条互相矛盾的通报拆开比对。她不提供安慰，只留下可以验证的时间和编号。', effects: { intel: 2, relationships: { 'qiu-lan': 2 } } },
      { id: 'support', label: '提供一包采样口罩', hint: '口罩包 -1，信任 +8，情报 +1', result: '她用口罩完成一次楼外采样，并把初步结果和异常编号完整报给你。', requirements: [{ item: 'masks', quantity: 1 }], effects: { inventory: { masks: -1 }, relationships: { 'qiu-lan': 8 }, intel: 1 } },
    ],
  },
  {
    npcId: 'pan-yue', channel: '五金行维修频段', allianceResult: '潘岳终于不再按次记账。他把老公寓的承重图和维修顺序交给你，并约定每次大修前都替你复核受力点。',
    options: [
      { id: 'consult', label: '让他听门框与管线异响', hint: '完整度 +6，信任 +2', result: '你把收音机贴近门框。潘岳从回声里判断出松动位置，指导你把临时支撑移到真正受力的地方。', effects: { shelter: { integrity: 6 }, relationships: { 'pan-yue': 2 } } },
      { id: 'support', label: '按指导使用一卷防水胶带', hint: '防水胶带 -1，完整度 +12，信任 +5', result: '胶带没有胡乱缠在裂缝上，而是与薄木条组成一道临时拉结。潘岳认可了你的手法。', requirements: [{ item: 'duct-tape', quantity: 1 }], effects: { inventory: { 'duct-tape': -1 }, shelter: { integrity: 12 }, relationships: { 'pan-yue': 5 } } },
    ],
  },
];

export const CONTACT_MAP = Object.fromEntries(CONTACTS.map((contact) => [contact.npcId, contact])) as Record<ContactNpcId, ContactDefinition>;
