export interface TradeOfferDefinition {
  id: string;
  npcId: 'chen-meng' | 'lin-zhou' | 'pan-yue' | 'qiu-lan';
  label: string;
  give: Record<string, number>;
  receive: Record<string, number>;
  result: string;
}

export const TRADE_OFFERS: TradeOfferDefinition[] = [
  { id: 'chen-sweets-water', npcId: 'chen-meng', label: '给楼里的孩子留点甜味', give: { chocolate: 1 }, receive: { 'water-bottle': 2 }, result: '陈檬把巧克力收进社区分发箱，递来两瓶登记过日期的水。' },
  { id: 'chen-light-rations', npcId: 'chen-meng', label: '交换公共值守物资', give: { candles: 1 }, receive: { 'canned-beans': 1, 'water-bottle': 1 }, result: '蜡烛被送到没有窗的楼梯间，你拿回一份公共储备。' },
  { id: 'chen-clean-battery', npcId: 'chen-meng', label: '用清洁用品换应急电池', give: { disinfectant: 1 }, receive: { batteries: 1 }, result: '消毒液归入公共药箱，一组尚未拆封的电池换到你手里。' },
  { id: 'lin-power-bandage', npcId: 'lin-zhou', label: '维持诊疗照明', give: { batteries: 1 }, receive: { bandage: 1 }, result: '林舟给头灯换上电池，把一卷重新密封的绷带推过门缝。' },
  { id: 'lin-water-antibiotics', npcId: 'lin-zhou', label: '给发热病人补水', give: { 'water-bottle': 2 }, receive: { antibiotics: 1 }, result: '两瓶水被立刻送去病房。林舟只肯拿一板临期抗生素交换。' },
  { id: 'lin-vitamins-painkiller', npcId: 'lin-zhou', label: '调整药箱配给', give: { vitamins: 1 }, receive: { painkiller: 1 }, result: '她核对包装日期，用一板止痛片换走更适合长期分发的维生素。' },
  { id: 'pan-food-tape', npcId: 'pan-yue', label: '给五金店值夜口粮', give: { 'canned-beans': 1 }, receive: { 'duct-tape': 2 }, result: '潘岳拉开抽屉，拿两卷胶带换走罐头，交易记得一笔不差。' },
  { id: 'pan-battery-steel', npcId: 'pan-yue', label: '换一块预切钢板', give: { batteries: 2 }, receive: { 'metal-sheet': 1 }, result: '钢板已经按老公寓门框钻好孔。潘岳收走两组电池，没有赊账。' },
  { id: 'pan-drink-board', npcId: 'pan-yue', label: '给搬运工补充体力', give: { 'sports-drink': 1 }, receive: { 'wood-board': 1 }, result: '饮料当场被分掉，一块沉重但平整的木板留给了你。' },
  { id: 'qiu-mask-filter', npcId: 'qiu-lan', label: '补充采样防护', give: { masks: 1 }, receive: { 'purifier-tablet': 1, 'filter-cloth': 1 }, result: '邱岚留下口罩包，换给你一套实验室临时净水材料。' },
  { id: 'qiu-battery-clean', npcId: 'qiu-lan', label: '为检测仪续电', give: { batteries: 1 }, receive: { disinfectant: 1 }, result: '检测仪重新亮起。她从采样箱侧袋取出一瓶消毒液。' },
  { id: 'qiu-sweets-vitamins', npcId: 'qiu-lan', label: '交换长期补给', give: { chocolate: 1 }, receive: { vitamins: 1 }, result: '巧克力被分成几小块，她把未开封的维生素留给你。' },
];

export const TRADE_OFFER_MAP = Object.fromEntries(TRADE_OFFERS.map((offer) => [offer.id, offer])) as Record<string, TradeOfferDefinition>;
