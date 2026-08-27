export interface SiegeWaveDefinition {
  day: number;
  name: string;
  pressure: number;
  reinforcementWear: number;
  warning: string;
}

export const HARD_SIEGE_WAVES: SiegeWaveDefinition[] = [
  { day: 3, name: '零散试探', pressure: 9, reinforcementWear: 0, warning: '主路上的零散感染者开始撞击沿街门窗。' },
  { day: 5, name: '楼道回流', pressure: 12, reinforcementWear: 0, warning: '附近街区的动静把一批感染者引进了居民楼。' },
  { day: 8, name: '长街主潮', pressure: 20, reinforcementWear: 1, warning: '尸潮主体抵达长街，卷闸门和楼梯间将连续受压。' },
  { day: 9, name: '楼梯间挤压', pressure: 21, reinforcementWear: 1, warning: '主潮没有散去，感染者整夜堆在楼梯转角并反复撞门。' },
  { day: 10, name: '商圈溃散', pressure: 23, reinforcementWear: 1, warning: '商业街的玻璃门成片碎裂，新的感染群正沿声音涌入住宅区。' },
  { day: 11, name: '夜间回潮', pressure: 25, reinforcementWear: 1, warning: '撤离广播惊动了地下空间里的感染者，楼道将再次承受整夜冲击。' },
  { day: 12, name: '广播诱发聚集', pressure: 27, reinforcementWear: 2, warning: '封锁线广播不断重播，附近几条街的感染者都被引向同一片住宅。' },
  { day: 13, name: '封锁线溃流', pressure: 30, reinforcementWear: 2, warning: '封锁线方向传来连续爆响，大规模人群正向旧城回流。' },
  { day: 14, name: '撤离前总冲击', pressure: 34, reinforcementWear: 2, warning: '车队灯光照亮街口，最后的感染群会在撤离窗口开启前撞向整栋楼。' },
];
