import { DIFFICULTY_MAP } from '../data/difficulties.ts';
import type { GameState, MetaState, Outcome } from '../types.ts';

export function truthEvidenceCount(state: GameState): number {
  const evidenceFlags = ['evidence-signal', 'evidence-ledger', 'evidence-van', 'evidence-flare'];
  const flagCount = evidenceFlags.filter((flag) => state.flags.includes(flag)).length;
  const itemCount = ['lab-badge', 'sample-tube', 'bus-manifest', 'sealed-letter']
    .filter((itemId) => state.inventory[itemId]?.some((batch) => batch.quantity > 0)).length;
  return flagCount + itemCount;
}

export function trustedNpcCount(state: GameState): number {
  return Object.values(state.relationships).filter((relation) => relation >= 18).length;
}

export function truthEndingReady(state: GameState): boolean {
  const decisionDay = DIFFICULTY_MAP[state.difficulty].truthDecisionDay;
  return state.phase === 'survival'
    && state.survivalDay >= decisionDay
    && state.flags.includes('truth-window-open')
    && !state.flags.includes('truth-attempted')
    && truthEvidenceCount(state) >= 3
    && trustedNpcCount(state) >= 2
    && (state.broadcasts >= 3 || state.flags.includes('decoded-broadcast'));
}

function deathOutcome(state: GameState): Outcome {
  const memoryEarned = 1 + Math.floor(state.survivalDay / 7);
  if (state.shelter.integrity <= 0) {
    return {
      id: 'death', variantId: 'death-shelter', title: '房门之后再无灯光',
      text: '最后一道门没能撑住。城市的声音越过门框，吞没了这间被你守了许多天的屋子。',
      memoryEarned, keyChoices: ['避难所完整度归零'],
    };
  }
  if (state.stats.hydration <= 0) {
    return {
      id: 'death', variantId: 'death-thirst', title: '水杯底只剩一道白印',
      text: '你把最后一口水留到太晚。记录本摊在桌上，最后几行字越来越轻，窗外的雨仍然不能直接喝。',
      memoryEarned, keyChoices: ['水分归零'],
    };
  }
  if (state.stats.satiety <= 0) {
    return {
      id: 'death', variantId: 'death-hunger', title: '清单上没有下一顿',
      text: '储物架终于只剩空包装。你仍记得每一种食物放过的位置，却没有力气再去门外找。',
      memoryEarned, keyChoices: ['饱腹归零'],
    };
  }
  if (state.injuries.includes('感染迹象') || state.injuries.includes('外伤')) {
    return {
      id: 'death', variantId: 'death-injury', title: '伤口没有等到天亮',
      text: '身体先于倒计时抵达极限。你把用过的药盒和症状时间写在墙上，希望下一次能更早处理。',
      memoryEarned, keyChoices: ['持续伤病未能控制'],
    };
  }
  return {
    id: 'death', variantId: 'death-exhaustion', title: '你的记录停在这一页',
    text: '身体先于倒计时抵达极限。你把剩下的线索写在墙上，希望下一次醒来时，还记得其中一点。',
    memoryEarned, keyChoices: ['健康归零'],
  };
}

function survivorOutcome(state: GameState): Outcome {
  const goal = DIFFICULTY_MAP[state.difficulty].survivalGoalDays;
  if (state.flags.includes('truth-attempt-failed')) {
    return {
      id: 'survivor', variantId: 'survivor-missed-signal', title: '普通结局 · 没发完的那份证据',
      text: `第${goal}天清晨，西侧通道开放。中继器里仍留着那份停在 63% 的数据，你把故障时间写进记录，随后跟着人群离开。真相没能越过封锁线，但你活着带走了失败的原因。`,
      memoryEarned: 3, keyChoices: ['尝试发送证据失败', '选择普通撤离'],
    };
  }
  if (trustedNpcCount(state) >= 2) {
    return {
      id: 'survivor', variantId: 'survivor-community', title: '普通结局 · 一起走过西侧通道',
      text: `第${goal}天清晨，西侧人行通道开放四小时。有人搬药箱，有人推水车，你负责清点人数。你们没有成为英雄，只是没有把任何还能走的人留在楼里。`,
      memoryEarned: 3, keyChoices: [`${trustedNpcCount(state)} 名盟友同行`, '选择普通撤离'],
    };
  }
  if (state.flags.includes('trusted-checkpoint')) {
    return {
      id: 'survivor', variantId: 'survivor-official', title: '普通结局 · 名单上的座位',
      text: `第${goal}天清晨，官方车辆终于出现在西侧通道。你按要求只带一只包，经过三次身份核验后坐进最后一排。车窗外的城市仍没有解释。`,
      memoryEarned: 3, keyChoices: ['选择相信官方撤离', '独自离城'],
    };
  }
  return {
    id: 'survivor', variantId: 'survivor-solo', title: '普通结局 · 西侧通道开放',
    text: `第${goal}天清晨，广播第一次没有重复昨天的录音。西侧人行通道开放四小时。你背起仍有重量的包，沿着墙边走出封锁区。`,
    memoryEarned: 3, keyChoices: ['坚持到撤离日', '选择普通撤离'],
  };
}

function truthOutcome(state: GameState): Outcome {
  if (trustedNpcCount(state) >= 3) {
    return {
      id: 'truth', variantId: 'truth-community', title: '隐藏结局 · 四个人的证词',
      text: '原始数据、楼内名单和四段互相印证的证词同时越过封锁线。天亮后，你们没有挤进官方车队，而是沿维修通道轮流背着设备离开。任何一个人的版本都不再是孤证。',
      memoryEarned: 5, keyChoices: [`${trustedNpcCount(state)} 名盟友共同作证`, '护送证据离城'],
    };
  }
  if (state.inventory['sample-tube']?.some((batch) => batch.quantity > 0) || state.flags.includes('evidence-signal')) {
    return {
      id: 'truth', variantId: 'truth-medical', title: '隐藏结局 · 样本与删改记录',
      text: '样本批次、检验校验码和症状记录被城外实验室完整接收。撤离车仍旧迟到，但第一份能被复核的医学证据已经无法抹去。你沿维修通道带走了剩余样本。',
      memoryEarned: 5, keyChoices: ['保住医学证据', '护送证据离城'],
    };
  }
  if (state.flags.includes('evidence-ledger')) {
    return {
      id: 'truth', variantId: 'truth-ledger', title: '隐藏结局 · 账簿上的三天',
      text: '采购账簿、车辆方向和备用钥匙的借用记录拼出了封锁前的三天空白。城外记者收到文件时，你正和同伴沿维修通道离开；纸上的名字开始被逐一核对。',
      memoryEarned: 5, keyChoices: ['保住采购账簿', '护送证据离城'],
    };
  }
  return {
    id: 'truth', variantId: 'truth-signal', title: '隐藏结局 · 信号越过封锁线',
    text: '原始数据被三个城外接收站同时保存。关于这场封锁的第一份完整证据已经无法被抹去。天亮时，你沿维修通道离开，把发送校验码写在衣袖内侧。',
    memoryEarned: 5, keyChoices: ['成功发送证据', '护送证据离城'],
  };
}

export function determineOutcome(state: GameState): Outcome | null {
  if (state.stats.health <= 0 || state.shelter.integrity <= 0) return deathOutcome(state);
  if (state.flags.includes('ending:truth')) return truthOutcome(state);
  if (state.flags.includes('ending:survivor')) return survivorOutcome(state);
  return null;
}

export function chooseEvacuation(state: GameState, route: 'survivor' | 'truth'): { state: GameState; ok: boolean; message?: string } {
  if (!state.flags.includes('evacuation-choice-pending')) return { state, ok: false, message: '撤离通道尚未开放。' };
  if (state.dailySettlement) return { state, ok: false, message: '先确认最后一天的愿望结算。' };
  if (route === 'truth' && !state.flags.includes('truth-transmitted')) return { state, ok: false, message: '证据尚未成功送出，无法选择维修通道。' };
  const next = structuredClone(state);
  next.flags = next.flags.filter((flag) => flag !== 'evacuation-choice-pending');
  next.flags.push(`ending:${route}`);
  const outcome = determineOutcome(next);
  if (!outcome) return { state, ok: false, message: '结局条件尚未形成。' };
  return { state: finishRun(next, outcome), ok: true };
}

export function finishRun(state: GameState, outcome: Outcome): GameState {
  return { ...state, phase: 'ended', outcome, currentEventId: undefined, dailyPlan: undefined, dailySettlement: undefined };
}

export function awardOutcome(meta: MetaState, state: GameState): MetaState {
  if (!state.outcome || meta.awardedRuns.includes(state.runId)) return meta;
  const next = structuredClone(meta);
  next.memory += state.outcome.memoryEarned;
  next.runs += 1;
  if (!next.endings.includes(state.outcome.id)) next.endings.push(state.outcome.id);
  next.awardedRuns.push(state.runId);
  return next;
}
