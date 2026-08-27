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
    description: '不依赖电网，适合把主食煮成一顿热饭。',
    cost: '燃料 -2 · 1小时',
    benefit: '饱腹 +38 · 水分 +6 · 精神 +6 · 体力 +4',
  },
  {
    id: 'microwave',
    name: '微波炉',
    source: '公寓自带',
    description: '最快的热食方式，但停电时只能闲置。',
    cost: '电力 -2 · 20分钟',
    benefit: '饱腹 +42 · 精神 +6 · 体力 +3',
  },
  {
    id: 'electric-hotpot',
    name: '电火锅',
    source: '公寓自带',
    description: '用水和方便面煮一锅热汤，恢复最全面。',
    cost: '电力 -3 · 1小时30分',
    benefit: '饱腹 +48 · 水分 +12 · 精神 +10 · 体力 +6',
  },
];

export const FURNITURE_MAP = Object.fromEntries(FURNITURE.map((item) => [item.id, item])) as Record<FurnitureId, FurnitureDefinition>;

export function createFurnitureState(): FurnitureState {
  return Object.fromEntries(FURNITURE.map((item) => [item.id, { condition: 100, enabled: true }])) as FurnitureState;
}

