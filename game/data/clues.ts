import { ITEM_MAP } from './items.ts';
import type { GameState } from '../types.ts';

export interface ClueDefinition {
  id: string;
  name: string;
  description: string;
  source: string;
  flag?: string;
  item?: string;
  evidence?: boolean;
}

export const CLUES: ClueDefinition[] = [
  { id: 'signal', name: '被删改的广播校验码', description: '邱岚给出的校验码证明公开播报与原始感染数据并不一致。', source: '社区广播线', flag: 'evidence-signal', evidence: true },
  { id: 'ledger', name: '异常物资调拨记录', description: '封锁前三天，有人以疾控名义集中调走低温箱与防化物资。', source: '河西超市 / 潘岳账簿', flag: 'evidence-ledger', evidence: true },
  { id: 'van', name: '无牌冷链车记录', description: '多处记录指向同一批没有登记目的地的冷链车辆。', source: '变电站与转运点', flag: 'evidence-van', evidence: true },
  { id: 'flare', name: '错误撤离信号', description: '官方照明弹把人群引向了没有开放的检查站。', source: '关键日广播事件', flag: 'evidence-flare', evidence: true },
  { id: 'list', name: '涂改后的隔离名单', description: '名单存在两种墨水和事后修改的车号，部分人员并未被送往医院。', source: '公交总站 / 地铁档案', flag: 'evidence-quarantine-list', evidence: true },
  { id: 'clinic-sample', name: '未登记低温样本', description: '样本批次与转运记录不一致，低温链最终指向北湖变电站。', source: '青禾诊所', flag: 'evidence-clinic-sample', evidence: true },
  { id: 'metro-message', name: '维修频道隐藏正文', description: '未寄出的信记录了封锁线内部人员对异常转运的质疑。', source: '地铁维修区', flag: 'evidence-metro-message', evidence: true },
  { id: 'substation-route', name: '变电站备用入口', description: '一条绕过正门报警器的电缆沟路线，可替代铜钥匙进入控制层。', source: '账簿、地铁或现场图纸', flag: 'substation-route' },
  { id: 'station-key', name: '变电站铜钥匙', description: ITEM_MAP['station-key'].description, source: '老潘五金行押金箱；也可取得备用入口路线绕过钥匙', item: 'station-key' },
  { id: 'warehouse-key', name: '河西后仓钥匙', description: ITEM_MAP['warehouse-key'].description, source: '河西超市厕所水箱', item: 'warehouse-key' },
  { id: 'manifest', name: '撤离车队名单', description: ITEM_MAP['bus-manifest'].description, source: '东郊总站', item: 'bus-manifest', evidence: true },
  { id: 'sample', name: 'C-17 低温样本', description: ITEM_MAP['sample-tube'].description, source: '诊所或变电站', item: 'sample-tube', evidence: true },
  { id: 'badge', name: '邱岚的疾控工牌', description: ITEM_MAP['lab-badge'].description, source: '青禾诊所', item: 'lab-badge', evidence: true },
  { id: 'sealed-letter', name: '未寄出的内部信', description: ITEM_MAP['sealed-letter'].description, source: '地铁维修区', item: 'sealed-letter', evidence: true },
];

export function isClueDiscovered(state: GameState, clue: ClueDefinition): boolean {
  const itemCount = clue.item ? (state.inventory[clue.item] ?? []).reduce((sum, batch) => sum + batch.quantity, 0) : 0;
  return Boolean((clue.flag && state.flags.includes(clue.flag)) || itemCount > 0);
}
