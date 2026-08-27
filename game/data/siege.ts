export interface SiegeWaveDefinition {
  day: number;
  name: string;
  pressure: number;
  warning: string;
}

export const HARD_SIEGE_WAVES: SiegeWaveDefinition[] = [
  { day: 3, name: '零散试探', pressure: 9, warning: '主路上的零散感染者开始撞击沿街门窗。' },
  { day: 5, name: '楼道回流', pressure: 12, warning: '附近街区的动静把一批感染者引进了居民楼。' },
  { day: 8, name: '长街主潮', pressure: 20, warning: '尸潮主体抵达长街，卷闸门和楼梯间将连续受压。' },
  { day: 11, name: '夜间回潮', pressure: 16, warning: '撤离广播惊动了被困在地下空间里的感染者。' },
  { day: 13, name: '封锁线溃流', pressure: 19, warning: '封锁线方向传来爆响，最后一批人群正向旧城回流。' },
];
