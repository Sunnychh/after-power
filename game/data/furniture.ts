import type { FurnitureId, FurnitureState } from '../types.ts';

export interface FurnitureDefinition {
  id: FurnitureId;
  name: string;
  source: string;
  description: string;
  cost: string;
  benefit: string;
  passive?: boolean;
}

export const FURNITURE: FurnitureDefinition[] = [
  {
    id: 'fridge',
    name: '双门冰箱',
    source: '公寓自带',
    description: '封锁后有电时会在夜间自动保鲜。',
    cost: '夜间电力 -1',
    benefit: '易腐物资保质期 +1 天',
    passive: true,
  },
  {
    id: 'gas-stove',
    name: '燃气炉',
    source: '公寓自带',
    description: '自行选择食材，尝试炖煮、焖饭或烙制料理。',
    cost: '燃料 2—3 · 1小时15分',
    benefit: '10 种配方 · 可优先使用储水',
  },
  {
    id: 'microwave',
    name: '微波炉',
    source: '公寓自带',
    description: '最快且较稳定，适合燕麦、蛋粉和罐头组合。',
    cost: '电力 -2 · 30分钟',
    benefit: '10 种配方 · 练习成本较低',
  },
  {
    id: 'electric-hotpot',
    name: '电火锅',
    source: '公寓自带',
    description: '自行选择食材，用较多水煮出恢复全面的热食。',
    cost: '电力 3—4 · 1小时30分',
    benefit: '10 种配方 · 高收益也更耗储备',
  },
];

export const FURNITURE_MAP = Object.fromEntries(FURNITURE.map((item) => [item.id, item])) as Record<FurnitureId, FurnitureDefinition>;

export function createFurnitureState(): FurnitureState {
  return Object.fromEntries(FURNITURE.map((item) => [item.id, { condition: 100, enabled: true }])) as FurnitureState;
}
