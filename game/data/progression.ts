/**
 * Items that open a major system, a deep-map branch, or a late-game ending
 * route. The fallback text is deliberately data-only so future UI can surface
 * it without teaching the engine about specific story prose.
 */
export const CRITICAL_PROGRESSION_ITEMS = [
  { itemId: 'radio', purpose: '广播、人物联络、幸存者交易与真相发送', fallback: '地铁四号线检修入口 · 壁挂应急通讯架' },
  { itemId: 'lockpick-set', purpose: '开锁技能与安静探索路线', fallback: '老潘五金行破损门面 · 维修学徒工具卷' },
  { itemId: 'crowbar', purpose: '强行开门与公交总站名单路线', fallback: '老潘五金行破损门面 · 维修学徒工具卷' },
  { itemId: 'multitool', purpose: '工具箱、钥匙与设备拆解路线', fallback: '地铁四号线站台 · 轨旁维修小车' },
  { itemId: 'toolkit', purpose: '修缮、电力与多处低风险拆解路线', fallback: '老潘五金行地下库房 · 应急维修柜' },
  { itemId: 'copper-wire', purpose: '外联中继与电力陷阱', fallback: '地铁四号线站台 · 轨旁维修小车' },
  { itemId: 'warehouse-key', purpose: '河西超市后仓办公室', fallback: '河西超市厕所 · 错位水箱盖' },
  { itemId: 'lab-badge', purpose: '青禾诊所检验冷柜', fallback: '青禾诊所候诊大厅 · 导诊台急救抽屉' },
  { itemId: 'station-key', purpose: '北湖变电站控制层低风险入口', fallback: '老潘五金行破损门面 · 柜台押金箱（也可先取得备用路线）' },
  { itemId: 'sample-tube', purpose: '医学证据与隐藏结局变体', fallback: '青禾诊所检验冷柜 / 北湖变电站控制层' },
  { itemId: 'bus-manifest', purpose: '撤离名单证据', fallback: '东郊公交总站档案室 · 调度档案柜' },
  { itemId: 'sealed-letter', purpose: '封锁内部通信证据', fallback: '河西超市后仓办公室 / 地铁设备走廊' },
] as const;

export type CriticalProgressionItemId = typeof CRITICAL_PROGRESSION_ITEMS[number]['itemId'];
