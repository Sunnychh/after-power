import type { LocationDefinition, NpcDefinition, Weather } from '../types.ts';

export const NPCS: NpcDefinition[] = [
  {
    id: 'lin-zhou',
    name: '林舟',
    role: '急诊护士',
    stance: '先救眼前的人，不拿药品换投机筹码。',
    description: '住在楼下，夜班刚停。她知道哪些伤口不能拖。',
  },
  {
    id: 'pan-yue',
    name: '潘岳',
    role: '五金店老板',
    stance: '物资要明码交换，承诺不能给发电机加油。',
    description: '嘴硬、记账清楚，对这片老楼的管线很熟。',
  },
  {
    id: 'qiu-lan',
    name: '邱岚',
    role: '疾控中心检验员',
    stance: '证据必须送出去，哪怕撤离因此延后。',
    description: '说话谨慎，似乎比广播更早知道封锁原因。',
  },
  {
    id: 'chen-meng',
    name: '陈檬',
    role: '社区网格员',
    stance: '先保住街坊，再谈谁该为封锁负责。',
    description: '熟悉每户住着谁，也知道哪些门已经没人回应。',
  },
];

export const NPC_MAP = Object.fromEntries(NPCS.map((npc) => [npc.id, npc]));

// 每次有效广播只建立一条新联络，顺序兼顾前期生存帮助与后期真相线。
export const NPC_BROADCAST_ORDER = ['chen-meng', 'lin-zhou', 'qiu-lan', 'pan-yue'] as const;

export const LOCATIONS: LocationDefinition[] = [
  {
    id: 'riverside-market',
    name: '河西生活超市',
    district: '河西路口 · 0.8km',
    risk: 28,
    description: '卷帘门卡在半腰，冷柜早已停转。后仓也许还有耐储食物。',
    loot: ['water-bottle', 'crackers', 'canned-beans', 'chocolate', 'candles'],
    uniqueItem: 'family-photo',
  },
  {
    id: 'qinghe-clinic',
    name: '青禾社区诊所',
    district: '梧桐街 · 1.4km',
    risk: 38,
    description: '候诊区空着，处置室的门从里面锁住了。空气里还有消毒水味。',
    loot: ['bandage', 'disinfectant', 'painkiller', 'masks', 'vitamins'],
    uniqueItem: 'lab-badge',
  },
  {
    id: 'pan-hardware',
    name: '老潘五金行',
    district: '旧城南巷 · 1.1km',
    risk: 42,
    description: '橱窗碎了，最重的东西反而留到了最后。楼上的脚步不太规律。',
    loot: ['duct-tape', 'wood-board', 'batteries', 'copper-wire', 'gloves'],
    uniqueItem: 'station-key',
  },
  {
    id: 'metro-line4',
    name: '地铁四号线检修口',
    district: '中心广场地下 · 2.0km',
    risk: 50,
    description: '站厅被封条截断，隧道风里夹着间歇性的广播报码。',
    loot: ['batteries', 'flashlight', 'rope', 'water-bottle', 'crowbar'],
    uniqueItem: 'sealed-letter',
  },
  {
    id: 'north-substation',
    name: '北湖变电站',
    district: '北湖工业带 · 2.6km',
    risk: 55,
    description: '围栏外没有人，控制楼里却还亮着一盏应急灯。',
    loot: ['copper-wire', 'batteries', 'fuel-can', 'toolkit', 'raincoat'],
  },
  {
    id: 'east-terminal',
    name: '东郊公交总站',
    district: '封锁线内环 · 3.1km',
    risk: 62,
    description: '十几辆公交车头朝外停着，调度室的传真机吐着半张纸。',
    loot: ['fuel-can', 'sports-drink', 'jerky', 'respirator', 'toolkit'],
    uniqueItem: 'bus-manifest',
  },
];

export const LOCATION_MAP = Object.fromEntries(LOCATIONS.map((location) => [location.id, location]));

export const WEATHER_SEQUENCE: Weather[] = [
  '晴冷', '闷热', '大雾', '暴雨', '晴冷', '酸雨', '寒潮', '晴冷',
];

export const ABILITIES = [
  { id: 'packer' as const, name: '仓管直觉', cost: 1, description: '每轮储物容量 +8kg。' },
  { id: 'map' as const, name: '旧城地图', cost: 2, description: '探索危险率 -8%，地点收益预览更清楚。' },
  { id: 'steady' as const, name: '危机耐受', cost: 3, description: '开局精神 +12，低精神惩罚减轻。' },
];
