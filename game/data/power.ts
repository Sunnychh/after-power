import type { PowerPolicy } from '../types.ts';

export interface PowerPolicyDefinition {
  id: PowerPolicy;
  name: string;
  expectedPower: number;
  description: string;
}

export const POWER_POLICIES: PowerPolicyDefinition[] = [
  { id: 'balanced', name: '均衡供电', expectedPower: 2, description: '冰箱低功率保鲜，再留一盏夜灯；有电时精神 +2。' },
  { id: 'cold', name: '保鲜优先', expectedPower: 2, description: '整夜维持冷藏，为有效易腐物额外延长 2 天；不开夜灯，精神 -1。' },
  { id: 'light', name: '照明优先', expectedPower: 2, description: '关闭冰箱，把电留给照明和设备充电；精神 +5、体力 +3。' },
  { id: 'off', name: '彻底节电', expectedPower: 0, description: '今夜不使用备用电；易腐物自然变质，黑暗使精神 -4。' },
];

export const POWER_POLICY_MAP = Object.fromEntries(POWER_POLICIES.map((policy) => [policy.id, policy])) as Record<PowerPolicy, PowerPolicyDefinition>;

