import type { DeepLocation } from './deep-exploration.ts';

const QINGHE_CLINIC: DeepLocation = {
  id: 'qinghe-clinic', name: '青禾社区诊所', entrance: 'reception', travelMinutes: 70, returnMinutes: 70, approachRisk: 20,
  scenes: [
    {
      id: 'reception', name: '候诊大厅', connections: ['treatment', 'pharmacy'],
      text: '叫号屏停在“B017”。塑料椅被推到门边形成一道仓促路障，导诊台上散着体温登记表，处置室和药房分别藏在两侧走廊。',
      targets: [{ id: 'triage-drawer', name: '导诊台急救抽屉', observation: '抽屉贴着“只限当班使用”，锁舌很浅；台下还露出半截交班记录。', options: [
        { id: 'pick', label: '安静拨开抽屉锁', hint: '30分钟 · 体力 -3 · 开锁经验 +2 · 取得检验工牌', result: '锁舌轻响后退。绷带下面压着邱岚的检验工牌，背面写着“冷柜权限未注销”。', minutes: 30, stamina: 3, requirements: [{ item: 'lockpick-set' }], loot: { bandage: 2, vitamins: 1, 'lab-badge': 1 }, skillXp: { lockpicking: 2 } },
        { id: 'search', label: '按交班记录寻找备用钥匙', hint: '35分钟 · 体力 -4 · 情报 ≥ 1 · 取得检验工牌', result: '钥匙粘在血压计电池盖背面。抽屉里除了耗材，还有一张权限没有注销的检验工牌。', minutes: 35, stamina: 4, requirements: [{ minIntel: 1 }], loot: { bandage: 2, vitamins: 1, 'lab-badge': 1 }, skillXp: { search: 2 } },
      ] }],
    },
    {
      id: 'treatment', name: '处置室', connections: ['reception', 'observation'],
      text: '不锈钢治疗车翻倒在洗手池边，地面留下已经干涸的消毒水印。观察室门虚掩着，里面偶尔传来输液架轻碰墙面的声音。',
      targets: [{ id: 'treatment-cart', name: '翻倒的治疗车', observation: '药品散在柜体夹层和墙角。徒手翻找很快，但玻璃安瓿已经碎了不少。', options: [
        { id: 'gloves', label: '戴手套逐层清理', hint: '40分钟 · 体力 -5 · 搜寻经验 +2 · 收获完整', result: '你先把碎玻璃归到弯盘，再从夹层取出未污染的耗材。', minutes: 40, stamina: 5, requirements: [{ item: 'gloves' }], loot: { disinfectant: 2, painkiller: 1 }, skillXp: { search: 2 } },
        { id: 'quick', label: '用布包手快速翻找', hint: '20分钟 · 体力 -7 · 有割伤风险', result: '你避开大块玻璃抓走能看见的药，袖口还是被划开一道。', minutes: 20, stamina: 7, loot: { disinfectant: 1, painkiller: 1 }, skillXp: { search: 1 }, danger: 24 },
      ] }],
    },
    {
      id: 'pharmacy', name: '药房窗口', connections: ['reception', 'lab'],
      text: '发药窗口的卷帘只落到一半，里面抽屉全贴着通用名。真正稀缺的药被锁在墙内柜，柜门上留着仓促擦过的指纹。',
      targets: [{ id: 'medicine-safe', name: '墙内药柜', observation: '电子锁已经断电，机械应急锁藏在铭牌下。强拆会压坏最靠门的药盒。', options: [
        { id: 'precision', label: '开启机械应急锁', hint: '65分钟 · 体力 -5 · 开锁 2级 · 抗生素较多', result: '你掀开铭牌找到锁孔，逐枚确认弹子，没有碰坏冷藏药盒。', minutes: 65, stamina: 5, requirements: [{ item: 'lockpick-set' }, { skill: 'lockpicking', minSkill: 2 }], loot: { antibiotics: 2, bandage: 1 }, skillXp: { lockpicking: 3 } },
        { id: 'pry', label: '用撬棍扭开柜门', hint: '30分钟 · 体力 -13 · 工具经验 +2 · 高噪声', result: '薄柜门从锁扣处撕开，外侧药盒被挤扁，只保住里面一板。', minutes: 30, stamina: 13, requirements: [{ item: 'crowbar' }], loot: { antibiotics: 1, bandage: 1 }, skillXp: { toolUse: 2 }, danger: 31 },
      ] }],
    },
    {
      id: 'observation', name: '留观室', connections: ['treatment', 'lab'],
      text: '六张病床都空着，床号卡却没有全部取下。最里面的帘子后堆着病人临时寄存的袋子，一只输液泵仍显示低电量。',
      targets: [{ id: 'bed-locker', name: '十三号床储物柜', observation: '柜门没有上锁，但袋子下压着一张转运路线图。拿物资很容易，判断哪些记录有用更费时间。', options: [
        { id: 'records', label: '核对床号与转运记录', hint: '45分钟 · 体力 -3 · 搜寻经验 +3 · 情报 +1', result: '十三号床并没有转去定点医院，而是去了东郊总站。路线图补上了广播里的空白。', minutes: 45, stamina: 3, loot: { 'sports-drink': 1, masks: 1 }, skillXp: { search: 3 }, effects: { intel: 1 }, addFlags: ['clinic-transfer-route'] },
        { id: 'supplies', label: '只拿无人认领的补给', hint: '15分钟 · 体力 -2 · 不冒额外风险', result: '你没有翻动病历，只取走密封饮料和口罩。', minutes: 15, stamina: 2, loot: { 'sports-drink': 1, masks: 1 }, skillXp: { search: 1 } },
      ] }],
    },
    {
      id: 'lab', name: '检验室与冷柜', connections: ['pharmacy', 'observation'],
      text: '离心机盖着防尘布，样本架已经搬空。角落小冷柜还接着一台蜂鸣不断的备用电源，门禁读卡器发出微弱红光。',
      targets: [{ id: 'lab-freezer', name: '检验冷柜', observation: '工牌可以正常开门；也可以修复备用电源后让门禁完成一次自检。柜底也许还有遗漏样本。', options: [
        { id: 'badge', label: '使用疾控中心工牌', hint: '20分钟 · 体力 -2 · 工牌保留 · 获得证据', result: '读卡器短促鸣响。柜底留下一个没有进入转运清单的低温样本管。', minutes: 20, stamina: 2, requirements: [{ item: 'lab-badge' }], loot: { 'sample-tube': 1 }, skillXp: { search: 2 }, addFlags: ['evidence-clinic-sample'] },
        { id: 'repair-power', label: '修复备用电源并读取缓存', hint: '70分钟 · 体力 -8 · 工具箱、铜线 · 工具经验 +3', result: '你绕过损坏的保险丝，门禁吐出最后一条离线记录：样本转往北湖变电站。', minutes: 70, stamina: 8, requirements: [{ item: 'toolkit' }, { item: 'copper-wire' }], consumes: { 'copper-wire': 1 }, loot: { 'sample-tube': 1, batteries: 1 }, skillXp: { toolUse: 3 }, effects: { intel: 1 }, addFlags: ['evidence-clinic-sample', 'substation-route'] },
      ] }],
    },
  ],
};

const PAN_HARDWARE: DeepLocation = {
  id: 'pan-hardware', name: '老潘五金行', entrance: 'storefront', travelMinutes: 60, returnMinutes: 60, approachRisk: 22,
  scenes: [
    { id: 'storefront', name: '破损门面', connections: ['aisles', 'cutting-room'], text: '橱窗碎口被纸箱勉强堵住，卷闸门停在膝盖高度。柜台后的监控屏全黑，通往货架和切割间的两条路都散着金属碎屑。', targets: [{ id: 'counter-box', name: '柜台押金箱', observation: '箱里没有现金，透孔能看到一串贴着“北湖”的铜钥匙牌。锁体结实，固定它的木台却已经受潮。', options: [
      { id: 'pick', label: '开启押金箱锁', hint: '55分钟 · 体力 -4 · 开锁 1级 · 获得变电站钥匙', result: '锁芯保养得很好。箱门弹开时，那串北湖钥匙仍压在签收单上。', minutes: 55, stamina: 4, requirements: [{ item: 'lockpick-set' }, { skill: 'lockpicking', minSkill: 1 }], loot: { 'station-key': 1 }, skillXp: { lockpicking: 3 } },
      { id: 'remove', label: '用工具箱拆下整只木台', hint: '45分钟 · 体力 -9 · 工具经验 +2', result: '你从受潮的台板下取出螺帽，押金箱连底座一起松开，钥匙从背面缝隙滑出。', minutes: 45, stamina: 9, requirements: [{ item: 'toolkit' }], loot: { 'station-key': 1, 'metal-scrap': 1 }, skillXp: { toolUse: 2 } },
    ] }, { id: 'apprentice-roll', name: '维修学徒的帆布工具卷', resolvedByFlag: 'hardware-apprentice-tools-recovered', observation: '柜台下面压着一卷写有姓名的帆布。长柄工具卡在变形踢脚板后，工具卷的搭扣则被碎玻璃和灰尘糊住。即使灾前漏买了开门工具，这里也留着一条代价更高的补救路线。', options: [
      { id: 'careful', label: '清走碎玻璃，徒手拆开踢脚板', hint: '55分钟 · 体力 -12 · 搜寻经验 +2 · 保证取得基础开门工具', result: '你先用废纸板把碎玻璃推远，再一点点掰开已经松动的踢脚板。帆布卷里是薄片开锁组，旁边还压着一根旧撬棍。', minutes: 55, stamina: 12, loot: { 'lockpick-set': 1, crowbar: 1 }, guaranteedLoot: ['lockpick-set', 'crowbar'], skillXp: { search: 2 }, addFlags: ['hardware-apprentice-tools-recovered'] },
      { id: 'force', label: '踩住柜台猛拉工具卷', hint: '25分钟 · 体力 -18 · 风险较高 · 保证取得基础开门工具', result: '踢脚板连着两颗钉子一起崩开，撬棍撞在地砖上。你被飞起的木刺划到手腕，但工具卷和长柄都完整。', minutes: 25, stamina: 18, loot: { 'lockpick-set': 1, crowbar: 1 }, guaranteedLoot: ['lockpick-set', 'crowbar'], skillXp: { toolUse: 1 }, danger: 31, addFlags: ['hardware-apprentice-tools-recovered'] },
    ] }] },
    { id: 'aisles', name: '紧固件货架', connections: ['storefront', 'backyard', 'basement'], text: '成盒螺丝散落在地，鞋底稍一拖动就发出滚珠般的响声。高架上还压着胶带和预切木料，最下层被倒柜卡住。', targets: [{ id: 'material-rack', name: '被压住的材料架', observation: '木板和胶带还能用。搬开倒柜不需要工具，但会把体力耗在最笨重的地方。', options: [
      { id: 'jack', label: '用撬棍抬起倒柜', hint: '35分钟 · 体力 -8 · 工具经验 +2', result: '撬棍吃住地砖缝，你用木楔垫住空隙，把材料逐件拖出。', minutes: 35, stamina: 8, requirements: [{ item: 'crowbar' }], loot: { 'wood-board': 2, 'duct-tape': 2 }, skillXp: { toolUse: 2 } },
      { id: 'lift', label: '徒手挪动倒柜', hint: '25分钟 · 体力 -18 · 有扭伤风险', result: '柜角只抬高一点，你趴在地上把最近的材料够出来，腰背立刻开始发紧。', minutes: 25, stamina: 18, loot: { 'wood-board': 1, 'duct-tape': 1 }, skillXp: { search: 1 }, danger: 26 },
    ] }] },
    { id: 'cutting-room', name: '切割与配钥匙间', connections: ['storefront', 'backyard'], text: '切割机上还夹着半截钢条，配钥匙机旁挂满没有标签的坯钥匙。墙边钢板架用链条固定，防止重物倾倒。', targets: [{ id: 'steel-rack', name: '链锁钢板架', observation: '薄钢板已经切成门框宽度。链锁能开、能拆，也能冒险砍断。', options: [
      { id: 'pick', label: '练习开启工业链锁', hint: '60分钟 · 体力 -6 · 开锁 2级 · 钢板 ×2', result: '粗锁芯比家用锁宽容，但每枚弹子都很沉。链条落地时你及时接住，没有发出巨响。', minutes: 60, stamina: 6, requirements: [{ item: 'lockpick-set' }, { skill: 'lockpicking', minSkill: 2 }], loot: { 'metal-sheet': 2 }, skillXp: { lockpicking: 3 } },
      { id: 'unbolt', label: '拆掉墙面固定环', hint: '45分钟 · 体力 -9 · 工具箱 · 钢板 ×2', result: '你保留了链锁，只拆下膨胀螺栓。钢板架向前松开两指宽，足够抽出材料。', minutes: 45, stamina: 9, requirements: [{ item: 'toolkit' }], loot: { 'metal-sheet': 2, 'metal-scrap': 1 }, skillXp: { toolUse: 3 } },
    ] }] },
    { id: 'backyard', name: '后院装卸棚', connections: ['aisles', 'cutting-room', 'basement'], text: '雨棚下停着一辆没牌照的三轮车，车斗里都是空油桶。排水沟旁有一只盖着帆布的工具笼，楼上窗户偶尔被风推开。', targets: [{ id: 'tool-cage', name: '装卸工具笼', observation: '笼里有手斧和多用钳。门栓从内侧落下，侧网有一处焊点开裂。', options: [
      { id: 'bend', label: '用撬棍扩大开裂焊点', hint: '30分钟 · 体力 -11 · 工具经验 +2 · 有噪声', result: '铁网发出一声长而刺耳的呻吟，裂口终于能伸进手臂拨开门栓。', minutes: 30, stamina: 11, requirements: [{ item: 'crowbar' }], loot: { hatchet: 1, multitool: 1 }, skillXp: { toolUse: 2 }, danger: 28 },
      { id: 'reach', label: '用尼龙绳套住内侧门栓', hint: '40分钟 · 体力 -5 · 搜寻经验 +2 · 安静', result: '你试了几次才让绳圈落到门栓上，缓慢向上提起，没有碰响网门。', minutes: 40, stamina: 5, requirements: [{ item: 'rope' }], loot: { hatchet: 1, multitool: 1 }, skillXp: { search: 2 } },
    ] }] },
    { id: 'basement', name: '地下库房', connections: ['aisles', 'backyard'], text: '台阶下有浓重机油味。地面用粉笔划分出“客户寄存”和“报废回收”，最深处的应急柜被水汽锈成暗红色。', targets: [{ id: 'emergency-locker', name: '应急维修柜', resolvedByFlag: 'hardware-emergency-locker-opened', observation: '柜门变形但没有完全锈死。标签注明里面应有电池、铜线和一套工具；一旦打开，柜内存货不会重新出现。', options: [
      { id: 'restore', label: '清理铰链后完整开柜', hint: '70分钟 · 体力 -8 · 多用钳 · 工具经验 +3 · 保证取得工具箱', result: '你刮掉锈层，逐次松动铰链。柜门最终按原方向打开，里面的工具箱和铜线都没有被挤坏。', minutes: 70, stamina: 8, requirements: [{ item: 'multitool' }], loot: { toolkit: 1, batteries: 2, 'copper-wire': 1 }, guaranteedLoot: ['toolkit'], skillXp: { toolUse: 3 }, addFlags: ['hardware-emergency-locker-opened'] },
      { id: 'hatchet', label: '沿锈穿处劈开薄板', hint: '30分钟 · 体力 -14 · 手斧 · 风险较高 · 永久放弃柜内工具箱', result: '锈板碎片落了一地。你只来得及拿走外层物资，工具箱被变形柜门彻底卡死；地下室深处随即传来拖动声。', minutes: 30, stamina: 14, requirements: [{ item: 'hatchet' }], loot: { batteries: 1, 'copper-wire': 1 }, skillXp: { toolUse: 2 }, danger: 36, addFlags: ['hardware-emergency-locker-opened'] },
    ] }] },
  ],
};

const METRO_LINE4: DeepLocation = {
  id: 'metro-line4', name: '地铁四号线检修口', entrance: 'service-gate', travelMinutes: 90, returnMinutes: 90, approachRisk: 26,
  scenes: [
    { id: 'service-gate', name: '检修入口', connections: ['concourse', 'service-corridor'], text: '铁栅栏后的楼梯直向地下，墙上应急疏散图被水泡出褶皱。检修门旁有值班柜，站厅方向和设备走廊都没有照明。', targets: [{ id: 'duty-locker', name: '值班员更衣柜', observation: '柜门贴着一张孩子画的列车。密码锁没电，薄背板可以拆，但可能损坏里面的纸张。', options: [
      { id: 'pick', label: '开启柜门应急锁', hint: '45分钟 · 体力 -4 · 开锁经验 +2', result: '锁开后，反光背心下压着检修区简图和一只手电。', minutes: 45, stamina: 4, requirements: [{ item: 'lockpick-set' }], loot: { flashlight: 1, batteries: 1 }, skillXp: { lockpicking: 2 }, effects: { intel: 1 }, addFlags: ['metro-map'] },
      { id: 'back-panel', label: '用多用钳拆背板', hint: '30分钟 · 体力 -7 · 工具经验 +2', result: '薄板弯出一道口子。图纸被划破一角，手电和电池仍完好。', minutes: 30, stamina: 7, requirements: [{ item: 'multitool' }], loot: { flashlight: 1, batteries: 1 }, skillXp: { toolUse: 2 } },
    ] }, { id: 'emergency-radio', name: '壁挂应急通讯架', resolvedByFlag: 'metro-emergency-radio-recovered', observation: '闸门旁的应急通讯架还挂着一台短波收音机。固定绳被塑料封签勒死，架子下方有一只机械释放扣；直接拽断会更快，也会让整面金属板发出巨响。', options: [
      { id: 'release', label: '摸清释放扣后取下收音机', hint: '45分钟 · 体力 -8 · 搜寻经验 +2 · 保证取得收音机', result: '你沿着钢索摸到被标牌挡住的释放扣。弹簧松开时，收音机和备用电池一起落进掌心。即使灾前没有购买设备，广播与幸存者联络线也重新有了入口。', minutes: 45, stamina: 8, loot: { radio: 1, batteries: 1 }, guaranteedLoot: ['radio'], skillXp: { search: 2 }, addFlags: ['metro-emergency-radio-recovered'] },
      { id: 'tear-free', label: '扯断封签并撬开薄挂板', hint: '20分钟 · 体力 -15 · 高噪声 · 保证取得收音机', result: '封签崩断，薄挂板砸上铁栅栏，声音沿楼梯一直滚到站厅。收音机外壳多了一道凹痕，调谐旋钮仍能转动。', minutes: 20, stamina: 15, loot: { radio: 1 }, guaranteedLoot: ['radio'], skillXp: { toolUse: 1 }, danger: 38, addFlags: ['metro-emergency-radio-recovered'] },
    ] }] },
    { id: 'concourse', name: '封闭站厅', connections: ['service-gate', 'platform'], text: '闸机全部断电，安检机传送带上还放着一个没有主人的帆布包。广播每隔七分钟播放一次已经失效的末班车提示。', targets: [{ id: 'security-bag', name: '安检机上的帆布包', observation: '包带缠进滚轴，直接拉会撕破。安检机侧盖用防拆螺丝固定，地上也有一根可够到包带的广告杆。', options: [
      { id: 'toolkit', label: '拆开安检机侧盖', hint: '50分钟 · 体力 -6 · 工具经验 +2 · 收获完整', result: '滚轴失去张力，帆布包完整退出。里面是通勤者准备的水和口粮。', minutes: 50, stamina: 6, requirements: [{ item: 'toolkit' }], loot: { 'water-bottle': 2, crackers: 2 }, skillXp: { toolUse: 2 } },
      { id: 'pole', label: '用广告杆挑断包带', hint: '20分钟 · 体力 -8 · 有跌落风险', result: '包带断开，帆布包摔到闸机另一侧。你翻过去时鞋底踩上湿滑广告纸。', minutes: 20, stamina: 8, loot: { 'water-bottle': 1, crackers: 1 }, skillXp: { search: 1 }, danger: 25 },
    ] }] },
    { id: 'platform', name: '四号线站台', connections: ['concourse', 'tunnel'], text: '屏蔽门停在半开状态，隧道风断断续续吹进来。长椅下压着一只维修包，远处列车尾灯像两点不会靠近的红光。', targets: [{ id: 'maintenance-cart', name: '轨旁维修小车', resolvedByFlag: 'metro-maintenance-cart-recovered', observation: '小车停在屏蔽门外半米处。可以用绳索拖回，也可以冒险跨下站台；车上的整套维修物资每轮只能取回一次。', options: [
      { id: 'rope', label: '用绳索套住车把拖回', hint: '35分钟 · 体力 -7 · 搜寻经验 +2 · 安全', result: '绳圈第三次才套住车把。小车轮沿轨旁槽缓慢滑回站台。', minutes: 35, stamina: 7, requirements: [{ item: 'rope' }], loot: { multitool: 1, 'copper-wire': 1, batteries: 1 }, guaranteedLoot: ['multitool', 'copper-wire'], skillXp: { search: 2 }, addFlags: ['metro-maintenance-cart-recovered'] },
      { id: 'climb-down', label: '跨下站台直接推车', hint: '20分钟 · 体力 -13 · 高风险 · 保证取得维修工具与铜线', result: '你刚把小车推到门边，隧道深处就传来钢轮滚动般的回声。车斗里有一把多用钳和一卷尚未氧化的铜线。', minutes: 20, stamina: 13, loot: { multitool: 1, 'copper-wire': 1, batteries: 1 }, guaranteedLoot: ['multitool', 'copper-wire'], skillXp: { toolUse: 1 }, danger: 42, addFlags: ['metro-maintenance-cart-recovered'] },
    ] }] },
    { id: 'service-corridor', name: '设备走廊', connections: ['service-gate', 'control-room', 'tunnel'], text: '电缆桥架沿头顶延伸，门牌依次写着“信号”“通风”“通信”。通信间门底塞着一封没有寄出的信，门锁却从里面反扣。', targets: [{ id: 'communication-room', name: '通信设备间', observation: '门后可能保存封锁初期的报码。通风百叶能拆，门锁也能精细处理。', options: [
      { id: 'vent', label: '拆下百叶伸手拨开反锁', hint: '55分钟 · 体力 -8 · 工具箱 · 工具经验 +3', result: '螺丝逐颗落进掌心。你从百叶口拨开门栓，在日志打印机旁找到那封信的正文。', minutes: 55, stamina: 8, requirements: [{ item: 'toolkit' }], loot: { 'sealed-letter': 1, batteries: 1 }, skillXp: { toolUse: 3 }, addFlags: ['evidence-metro-message'] },
      { id: 'pick', label: '从外侧处理双舌锁', hint: '75分钟 · 体力 -6 · 开锁 3级 · 安静', result: '第二道锁舌比第一道更紧。门开后，通信日志没有被破坏。', minutes: 75, stamina: 6, requirements: [{ item: 'lockpick-set' }, { skill: 'lockpicking', minSkill: 3 }], loot: { 'sealed-letter': 1, batteries: 1 }, skillXp: { lockpicking: 3 }, effects: { intel: 1 }, addFlags: ['evidence-metro-message'] },
    ] }] },
    { id: 'tunnel', name: '隧道与联络通道', connections: ['platform', 'service-corridor', 'control-room'], text: '道床上的碎石让每一步都很响。两百米外有一扇标着东郊方向的联络门，墙边线路箱仍亮着一枚绿色电容指示灯。', targets: [{ id: 'route-panel', name: '线路与逃生图箱', observation: '透明图箱后有一张未公开的维修通道图。外壳能撬开，也可以顺着检修编号找到卡扣。', options: [
      { id: 'decode', label: '按检修编号寻找隐藏卡扣', hint: '50分钟 · 体力 -5 · 情报 ≥ 2 · 搜寻经验 +3', result: '编号不是日期，而是沿线里程。正确位置的卡扣按下后，图箱无声打开。', minutes: 50, stamina: 5, requirements: [{ minIntel: 2 }], loot: { rope: 1 }, skillXp: { search: 3 }, effects: { intel: 1 }, addFlags: ['substation-route', 'metro-escape-route'] },
      { id: 'pry', label: '用撬棍打开图箱', hint: '20分钟 · 体力 -10 · 工具经验 +1 · 有噪声', result: '透明板裂成几块，地图边缘也被划破，但北湖入口仍看得清。', minutes: 20, stamina: 10, requirements: [{ item: 'crowbar' }], loot: { rope: 1 }, skillXp: { toolUse: 1 }, danger: 29, addFlags: ['substation-route'] },
    ] }] },
    { id: 'control-room', name: '车站控制室', connections: ['service-corridor', 'tunnel'], text: '控制台覆盖着薄灰，硬盘阵列只剩一盏黄灯。墙面白板写着封锁日的调度变更，几班“空载列车”实际停靠记录被人擦过。', targets: [{ id: 'dispatch-terminal', name: '离线调度终端', observation: '终端需要短时供电。可以接入电池，也能拆出硬盘带走关键记录。', options: [
      { id: 'battery', label: '用电池启动终端导出记录', hint: '60分钟 · 体力 -5 · 电池 -1 · 情报 +2', result: '屏幕亮了四分钟。你抄下被删除的车辆编号和东郊终点站。', minutes: 60, stamina: 5, requirements: [{ item: 'batteries' }], consumes: { batteries: 1 }, loot: {}, skillXp: { search: 2 }, effects: { intel: 2 }, addFlags: ['evidence-quarantine-list'] },
      { id: 'drive', label: '拆下硬盘与备用电芯', hint: '45分钟 · 体力 -8 · 工具箱 · 工具经验 +3', result: '你按接口顺序拔掉数据线，标签背面写着东郊总站的调度室编号。', minutes: 45, stamina: 8, requirements: [{ item: 'toolkit' }], loot: { batteries: 2, 'metal-scrap': 1 }, skillXp: { toolUse: 3 }, effects: { intel: 1 }, addFlags: ['evidence-quarantine-list'] },
    ] }] },
  ],
};

const NORTH_SUBSTATION: DeepLocation = {
  id: 'north-substation', name: '北湖变电站', entrance: 'perimeter', travelMinutes: 110, returnMinutes: 110, approachRisk: 28,
  scenes: [
    { id: 'perimeter', name: '围栏与门卫室', connections: ['switchyard', 'lobby'], text: '围栏上挂着褪色的高压警示牌，门卫室玻璃没有破。访客登记本停在封锁前一晚，控制楼门禁仍靠备用电发着红光。', targets: [{ id: 'guard-cabinet', name: '门卫应急柜', observation: '柜中有绝缘手套、雨衣和访客路线图。锁不复杂，但门卫室地板满是碎玻璃。', options: [
      { id: 'gloves', label: '戴手套清理玻璃后开柜', hint: '35分钟 · 体力 -5 · 搜寻经验 +2', result: '你把碎玻璃扫到墙边，从柜后找到标注控制层备用入口的访客图。', minutes: 35, stamina: 5, requirements: [{ item: 'gloves' }], loot: { raincoat: 1, gloves: 1 }, skillXp: { search: 2 }, addFlags: ['substation-route'] },
      { id: 'quick', label: '踩过碎玻璃直接取物', hint: '15分钟 · 体力 -7 · 有割伤风险 · 取得备用路线', result: '柜锁被门框挤开了一半。你够到雨衣，也扯下压在后面的访客路线图；纸角沾了血，但控制层备用入口仍看得清。', minutes: 15, stamina: 7, loot: { raincoat: 1 }, skillXp: { search: 1 }, danger: 24, addFlags: ['substation-route'] },
    ] }] },
    { id: 'switchyard', name: '露天开关场', connections: ['perimeter', 'cable-room'], text: '瓷瓶和母线在头顶排成冷硬的几何形。远处一组应急蓄电柜仍有电压，积水却已经漫到检修步道边缘。', targets: [{ id: 'battery-bank', name: '站用蓄电柜', observation: '电芯能为避难所补电，但整组蓄电柜只能安全拆取一次；拆错顺序还会造成短路。柜门贴着检修流程，最后三步被雨泡糊了。', resolvedByFlag: 'substation-battery-bank-drained', options: [
      { id: 'procedure', label: '按线路图隔离后拆取电芯', hint: '75分钟 · 体力 -9 · 工具箱、情报 ≥ 2 · 本轮一次 · 电力 +12', result: '你逐段确认无压，拆下一组仍健康的电芯，端子没有冒出火花。剩余柜组进入欠压保护，不能再拆。', minutes: 75, stamina: 9, requirements: [{ item: 'toolkit' }, { minIntel: 2 }], loot: { batteries: 2, 'copper-wire': 1 }, skillXp: { toolUse: 3 }, effects: { shelter: { power: 12 } }, addFlags: ['substation-battery-bank-drained'] },
      { id: 'quick-disconnect', label: '用绝缘布快速断开端子', hint: '35分钟 · 体力 -13 · 高风险 · 本轮一次 · 电力 +6', result: '扳手碰到柜壁时蓝光一闪。你拖走半组电芯，剩下的已经保护跳闸，无法再次取电。', minutes: 35, stamina: 13, requirements: [{ item: 'gloves' }], loot: { batteries: 1 }, skillXp: { toolUse: 2 }, effects: { shelter: { power: 6 } }, danger: 41, addFlags: ['substation-battery-bank-drained'] },
    ] }] },
    { id: 'lobby', name: '控制楼大厅', connections: ['perimeter', 'control-floor', 'cable-room'], text: '大厅里有两道门禁：值班室和通往二层控制层的防火门。墙上人员表被撕走，地面却留着拖运低温箱的轮印。', targets: [{ id: 'duty-desk', name: '值班室文件柜', observation: '抽屉标签写着故障记录、车辆登记和外来施工。最下层上锁，旁边碎纸机还塞着半张盖章表。', options: [
      { id: 'pick', label: '开启最下层文件锁', hint: '50分钟 · 体力 -4 · 开锁 1级 · 情报 +2', result: '文件按日期排列。封锁前夜有一辆无牌冷链车进入控制楼。', minutes: 50, stamina: 4, requirements: [{ item: 'lockpick-set' }, { skill: 'lockpicking', minSkill: 1 }], loot: { 'copper-wire': 1 }, skillXp: { lockpicking: 2 }, effects: { intel: 2 }, addFlags: ['evidence-van'] },
      { id: 'reassemble', label: '拼回碎纸机里的表格', hint: '65分钟 · 体力 -3 · 搜寻经验 +3', result: '你按印章边缘和纸纤维拼回大半张进出记录，车牌栏只有一道红色斜线。', minutes: 65, stamina: 3, loot: {}, skillXp: { search: 3 }, effects: { intel: 2 }, addFlags: ['evidence-van'] },
    ] }] },
    { id: 'cable-room', name: '电缆夹层', connections: ['switchyard', 'lobby', 'control-floor'], text: '粗电缆从地板孔洞垂向地下，备用照明每隔几秒闪一次。墙边维修箱锁着，地上还有一只遗落的密封燃料罐。', targets: [{ id: 'maintenance-chest', name: '高压维修箱', observation: '维修箱里可能有完整工具和铜料。箱锁防撬，但合页能从侧面处理。', options: [
      { id: 'lockpick', label: '精细开启防撬锁', hint: '70分钟 · 体力 -6 · 开锁 3级 · 收获完整', result: '防钻片让手感变得模糊。你花了很久才听见锁舌完全退回。', minutes: 70, stamina: 6, requirements: [{ item: 'lockpick-set' }, { skill: 'lockpicking', minSkill: 3 }], loot: { toolkit: 1, 'copper-wire': 2, 'fuel-can': 1 }, skillXp: { lockpicking: 3 } },
      { id: 'hinge', label: '用手斧和撬棍破坏合页', hint: '35分钟 · 体力 -17 · 高噪声', result: '合页销被砸进箱体。你抢出燃料和一卷铜线，工具箱被变形柜门卡住。', minutes: 35, stamina: 17, requirements: [{ item: 'hatchet' }, { item: 'crowbar' }], loot: { 'copper-wire': 1, 'fuel-can': 1 }, skillXp: { toolUse: 3 }, danger: 43 },
    ] }] },
    { id: 'control-floor', name: '变电站控制层', connections: ['lobby', 'cable-room'], text: '整面模拟屏只剩北区线路亮着。角落低温箱接在独立插座上，操作台抽屉贴有“C-17”批次标签。进入核心区需要钥匙、备用路线，或者一次代价很高的强拆。', targets: [{ id: 'control-core', name: '核心控制区与低温箱', observation: '铜钥匙风险最低；备用入口要穿过狭窄电缆沟；正面强拆会惊动楼外。三条路都会留下不同痕迹。', resolvedByFlag: 'substation-control-searched', options: [
      { id: 'key', label: '使用变电站铜钥匙进入', hint: '45分钟 · 体力 -7 · 低风险 · 样本证据、电力 +10', result: '钥匙和锁芯编号完全吻合。你关闭报警回路，取出样本并抄下异常供电指令。', minutes: 45, stamina: 7, requirements: [{ item: 'station-key' }], loot: { 'sample-tube': 1, batteries: 1 }, skillXp: { search: 3 }, effects: { shelter: { power: 10 }, intel: 1 }, addFlags: ['substation-control-searched', 'evidence-quarantine-list'] },
      { id: 'route', label: '沿备用入口路线穿过电缆沟', hint: '70分钟 · 体力 -14 · 需要已发现路线 · 中风险', result: '你贴着电缆沟爬到控制柜背面，从检修口进入。衣服全是灰，报警器没有响。', minutes: 70, stamina: 14, requirements: [{ flag: 'substation-route' }], loot: { 'sample-tube': 1, batteries: 1 }, skillXp: { search: 3 }, effects: { shelter: { power: 8 }, intel: 1 }, danger: 30, addFlags: ['substation-control-searched', 'evidence-quarantine-list'] },
      { id: 'breach', label: '切断门栓强行进入', hint: '40分钟 · 体力 -19 · 手斧、工具箱 · 高风险', result: '门栓断开时警报短促响起。你只够时间带走样本和一组电池。', minutes: 40, stamina: 19, requirements: [{ item: 'hatchet' }, { item: 'toolkit' }], loot: { 'sample-tube': 1, batteries: 1 }, skillXp: { toolUse: 3 }, effects: { shelter: { power: 5 } }, danger: 55, addFlags: ['substation-control-searched'] },
    ] }] },
  ],
};

const EAST_TERMINAL: DeepLocation = {
  id: 'east-terminal', name: '东郊公交总站', entrance: 'forecourt', travelMinutes: 120, returnMinutes: 120, approachRisk: 32,
  scenes: [
    { id: 'forecourt', name: '站前广场', connections: ['dispatch-hall', 'bus-bay'], text: '十几辆公交车头朝封锁线停着，雨棚下堆满被遗弃的行李。电子站牌循环显示“线路调整”，没有一辆车真正发出。', targets: [{ id: 'luggage-pile', name: '雨棚行李堆', observation: '大部分箱包被翻过，一只带医药标志的拉杆箱卡在长椅下。靠近很容易，但广场没有遮挡。', options: [
      { id: 'observe', label: '先观察广场动静再取箱', hint: '35分钟 · 体力 -4 · 搜寻经验 +2 · 风险较低', result: '你等脚步声离开候车区才弯腰拖出箱子，拉链里还有基础药品。', minutes: 35, stamina: 4, loot: { bandage: 1, vitamins: 1, 'sports-drink': 1 }, skillXp: { search: 2 }, danger: 14 },
      { id: 'rush', label: '快速拖出箱子返回遮挡', hint: '15分钟 · 体力 -10 · 风险较高', result: '轮子卡在地砖缝里，你不得不提起整只箱子冲回门柱后。', minutes: 15, stamina: 10, loot: { bandage: 1, 'sports-drink': 1 }, skillXp: { search: 1 }, danger: 34 },
    ] }] },
    { id: 'dispatch-hall', name: '调度大厅', connections: ['forecourt', 'archive', 'repair-bay'], text: '传真机吐着半张纸，玻璃隔间里的排班表被红笔划满。售票柜台卷门锁着，后方档案室门牌歪向一边。', targets: [{ id: 'fax-terminal', name: '调度传真与值班终端', observation: '传真纸记录最后几次临时调车。终端还能用移动电源启动，也可以直接检查传真机缓存带。', options: [
      { id: 'power', label: '用电池启动值班终端', hint: '55分钟 · 体力 -4 · 电池 -1 · 情报 +2', result: '终端显示几辆登记为空载的公交实际装有隔离转运人员，目的地被改成北湖。', minutes: 55, stamina: 4, requirements: [{ item: 'batteries' }], consumes: { batteries: 1 }, loot: {}, skillXp: { search: 2 }, effects: { intel: 2 }, addFlags: ['evidence-van'] },
      { id: 'ribbon', label: '拆出传真机缓存带逐段辨认', hint: '70分钟 · 体力 -5 · 多用钳 · 搜寻经验 +3', result: '反写字迹在手机黑屏的反光里逐渐可读，你记下三辆车和对应批次。', minutes: 70, stamina: 5, requirements: [{ item: 'multitool' }], loot: { 'copper-wire': 1 }, skillXp: { search: 3 }, effects: { intel: 1 }, addFlags: ['evidence-van'] },
    ] }] },
    { id: 'bus-bay', name: '停车发车区', connections: ['forecourt', 'repair-bay'], text: '车辆按线路停成两排，几扇车门仍开着。最外侧一辆混动公交的应急舱盖没有锁，车厢后排放着司机们的公共补给箱。', targets: [{ id: 'driver-cache', name: '司机公共补给箱', observation: '箱体被钢缆锁在座椅下。锁可以开，座椅固定螺栓也能拆；砍钢缆最快但声音会传遍车场。', options: [
      { id: 'pick', label: '开启钢缆锁', hint: '55分钟 · 体力 -5 · 开锁 2级 · 补给完整', result: '钢缆松开后，箱内水和肉干按司机编号分成小袋。', minutes: 55, stamina: 5, requirements: [{ item: 'lockpick-set' }, { skill: 'lockpicking', minSkill: 2 }], loot: { 'water-bottle': 2, jerky: 2, 'instant-coffee': 1 }, skillXp: { lockpicking: 3 } },
      { id: 'seat', label: '拆掉座椅固定螺栓', hint: '45分钟 · 体力 -9 · 工具箱 · 可回收材料', result: '座椅连着钢缆一起松开。你保住补给，也拆到几块能用的金属件。', minutes: 45, stamina: 9, requirements: [{ item: 'toolkit' }], loot: { 'water-bottle': 2, jerky: 1, 'metal-scrap': 2 }, skillXp: { toolUse: 3 } },
    ] }] },
    { id: 'repair-bay', name: '维修车间', connections: ['dispatch-hall', 'bus-bay', 'archive'], text: '举升机停在半空，地沟里积着黑水。墙边防火柜和轮胎架之间夹着燃料、工具与一块可以裁成门板的薄钢片。', targets: [{ id: 'fire-cabinet', name: '维修防火柜', observation: '柜内有密封燃料和工具，旋钮锁被油污糊住。清理锁体费时间，撬开则可能碰倒旁边油桶。', options: [
      { id: 'clean-lock', label: '清理并开启旋钮锁', hint: '65分钟 · 体力 -7 · 多用钳 · 开锁经验 +2', result: '油泥一点点从刻度槽里退出，旋钮终于能读数。柜内燃料罐没有渗漏。', minutes: 65, stamina: 7, requirements: [{ item: 'multitool' }], loot: { 'fuel-can': 1, toolkit: 1, 'metal-sheet': 1 }, skillXp: { lockpicking: 2 } },
      { id: 'pry', label: '用撬棍撕开柜门', hint: '30分钟 · 体力 -15 · 高风险 · 收获较少', result: '柜门撞上油桶，刺鼻气味立刻散开。你抓走一罐燃料和钢片撤出车间。', minutes: 30, stamina: 15, requirements: [{ item: 'crowbar' }], loot: { 'fuel-can': 1, 'metal-sheet': 1 }, skillXp: { toolUse: 2 }, danger: 44 },
    ] }] },
    { id: 'archive', name: '档案室与调度办公室', connections: ['dispatch-hall', 'repair-bay'], text: '铁皮档案柜按年份排列，封锁当月的抽屉却换了新锁。桌面电话停在免提状态，旁边压着一张只打印到一半的撤离名单。', targets: [{ id: 'manifest-drawer', name: '封锁期调度档案柜', observation: '完整名单应该在锁住的抽屉内。精细开锁能保住纸张，强拆会让柜体向后倾倒。', options: [
      { id: 'pick', label: '开启新换的档案锁', hint: '75分钟 · 体力 -6 · 开锁 3级、情报 ≥ 2 · 完整证据', result: '最后一枚弹子比其他的短。抽屉打开，撤离车队名单和手写改动记录都在。', minutes: 75, stamina: 6, requirements: [{ item: 'lockpick-set' }, { skill: 'lockpicking', minSkill: 3 }, { minIntel: 2 }], loot: { 'bus-manifest': 1 }, skillXp: { lockpicking: 3 }, effects: { intel: 1 }, addFlags: ['evidence-quarantine-list'] },
      { id: 'brace-pry', label: '扶住柜体后用撬棍破锁', hint: '40分钟 · 体力 -16 · 撬棍 · 高风险', result: '柜体几次要向后倒下。锁扣最终崩开，名单边角被撕裂，关键车号仍可辨认。', minutes: 40, stamina: 16, requirements: [{ item: 'crowbar' }], loot: { 'bus-manifest': 1 }, skillXp: { toolUse: 3 }, danger: 37, addFlags: ['evidence-quarantine-list'] },
    ] }] },
  ],
};

export const ADDITIONAL_DEEP_LOCATIONS: DeepLocation[] = [QINGHE_CLINIC, PAN_HARDWARE, METRO_LINE4, NORTH_SUBSTATION, EAST_TERMINAL];
