export type EntertainmentId = 'journal' | 'read' | 'cards' | 'music';

export interface EntertainmentDefinition {
  id: EntertainmentId;
  name: string;
  minutes: number;
  morale: number;
  description: string;
  requiredItem?: string;
}

export const ENTERTAINMENT: EntertainmentDefinition[] = [
  { id: 'journal', name: '整理今天的日记', minutes: 45, morale: 4, description: '你把发生过的事按时间写下来。能说清恐惧来自哪里，它就不再占满整间屋子。' },
  { id: 'read', name: '读一章旧小说', minutes: 90, morale: 9, description: '纸页里的人仍在追查一桩与封锁无关的旧案。九十分钟里，门外的声音只是背景。', requiredItem: 'paperback' },
  { id: 'cards', name: '摆一局纸牌接龙', minutes: 60, morale: 7, description: '缺掉的方块七用纸片代替。把杂乱牌面一点点归位，至少有件事仍遵守规则。', requiredItem: 'playing-cards' },
  { id: 'music', name: '听一张旧专辑', minutes: 60, morale: 12, description: '你戴上耳机，把音量压到只够自己听见。熟悉的前奏短暂盖过楼道里的摩擦声。', requiredItem: 'music-player' },
];

export const ENTERTAINMENT_MAP = Object.fromEntries(ENTERTAINMENT.map((activity) => [activity.id, activity])) as Record<EntertainmentId, EntertainmentDefinition>;
