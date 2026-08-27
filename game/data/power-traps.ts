export interface PowerTrapDefinition {
  level: number;
  name: string;
  attack: number;
  powerCost: number;
  minutes: number;
  materials: Record<string, number>;
  description: string;
}

export const POWER_TRAPS: PowerTrapDefinition[] = [
  { level: 1, name: '门磁电击线', attack: 5, powerCost: 2, minutes: 90, materials: { 'copper-wire': 1, batteries: 1 }, description: '在第一轮撞击时释放短脉冲，把门外最靠前的感染者击倒。' },
  { level: 2, name: '脉冲门框', attack: 10, powerCost: 3, minutes: 150, materials: { 'copper-wire': 1, 'metal-scrap': 2 }, description: '把导线藏进金属门框，连续脉冲会削弱尸潮前排的挤压力。' },
  { level: 3, name: '高压走廊网', attack: 16, powerCost: 4, minutes: 180, materials: { 'copper-wire': 2, 'metal-sheet': 1 }, description: '整段楼道成为可控放电区，在冲击真正落到加固层前先截断一批目标。' },
];

export function powerTrapDefinition(level: number): PowerTrapDefinition | undefined {
  return POWER_TRAPS.find((trap) => trap.level === level);
}
