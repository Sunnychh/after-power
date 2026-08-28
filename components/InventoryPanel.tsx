'use client';

import { useState } from 'react';
import { CATEGORY_ORDER, formatItemEffects, ITEM_MAP } from '../game/data/items.ts';
import { FURNITURE } from '../game/data/furniture.ts';
import { batchExpiryStatus, inventoryCount } from '../game/engine/inventory.ts';
import { inventorySummary } from '../game/engine/actions.ts';
import { absoluteDay } from '../game/engine/state.ts';
import type { GameState } from '../game/types.ts';
import { POWER_POLICY_MAP } from '../game/data/power.ts';
import { nightPowerBudget, siegeMitigation } from '../game/engine/siege.ts';
import { foodVarietyPreview } from '../game/engine/nutrition.ts';
import { CLUES, isClueDiscovered } from '../game/data/clues.ts';
import { RECIPES } from '../game/data/recipes.ts';
import { powerTrapDefinition } from '../game/data/power-traps.ts';

export function InventoryPanel({ state, open, onClose, onUse }: {
  state: GameState;
  open: boolean;
  onClose: () => void;
  onUse: (itemId: string) => void;
}) {
  const [tab, setTab] = useState<'inventory' | 'shelter' | 'archive'>('inventory');
  const summary = inventorySummary(state);
  const currentDay = absoluteDay(state);
  const powerPolicy = POWER_POLICY_MAP[state.powerPolicy];
  const powerBudget = nightPowerBudget(state);
  const entries = Object.keys(state.inventory)
    .map((id) => ITEM_MAP[id])
    .filter(Boolean)
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.name.localeCompare(b.name));

  return (
    <aside className={`inventory-panel ${open ? 'open' : ''}`} aria-label="背包与避难所">
      <div className="mobile-drawer-head">
        <strong>物资与避难所</strong>
        <button type="button" className="icon-button" onClick={onClose} aria-label="关闭背包">×</button>
      </div>
      <div className="panel-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'inventory'} onClick={() => setTab('inventory')}>物资</button>
        <button type="button" role="tab" aria-selected={tab === 'shelter'} onClick={() => setTab('shelter')}>避难所</button>
        <button type="button" role="tab" aria-selected={tab === 'archive'} onClick={() => setTab('archive')}>档案</button>
      </div>
      {tab === 'inventory' ? (
        <div className="inventory-content">
          <div className="weight-meter">
            <div><span>储物重量</span><b>{summary.weight.toFixed(1)} / {summary.capacity} kg</b></div>
            <span><i style={{ width: `${Math.min(100, summary.weight / summary.capacity * 100)}%` }} /></span>
          </div>
          {!entries.length && <p className="empty-state">储物架还是空的。灾前去商店采购，封锁后外出搜寻。</p>}
          <div className="item-list">
            {entries.map((item) => {
              const batches = [...(state.inventory[item.id] ?? [])]
                .sort((a, b) => (a.expiresOn ?? Infinity) - (b.expiresOn ?? Infinity) || a.acquiredOn - b.acquiredOn);
              const effects = formatItemEffects(item);
              const varietyPreview = foodVarietyPreview(state, item);
              return (
                <article className="item-row" key={item.id}>
                  <div className="item-main">
                    <div>
                      <strong title={`${item.name} ×${inventoryCount(state.inventory, item.id)}`}>{item.name} <em>×{inventoryCount(state.inventory, item.id)}</em></strong>
                      <span className={`category-pill category-${item.category}`}>{item.category}</span>
                      {effects.length > 0 && <span className="effect-list">{effects.map((effect) => <i key={effect}>{effect}</i>)}</span>}
                      <span className="item-description" title={item.description}>{item.description}</span>
                      {varietyPreview && <span className={`variety-preview ${state.recentMeals.at(-1) === item.id ? 'repeat' : ''}`} title={varietyPreview}>饮食：{varietyPreview}</span>}
                      <span>{item.weight}kg / 件</span>
                      <span className="expiry-batches" aria-label={`${item.name}保存期限`}>
                        {item.perishableDays ? batches.map((batch, index) => {
                          const expiry = batchExpiryStatus(batch.expiresOn, currentDay);
                          return (
                            <i className={`expiry-${expiry.state}`} key={`${batch.acquiredOn}-${batch.expiresOn}-${index}`}>
                              ×{batch.quantity} · {expiry.state === 'spoiled' ? item.expiredLabel ?? expiry.label : expiry.label}
                            </i>
                          );
                        }) : <i className="expiry-stable">长期保存 · 无腐烂倒计时</i>}
                      </span>
                    </div>
                  </div>
                  {item.usable && state.phase !== 'ended' && <button type="button" onClick={() => onUse(item.id)}>使用</button>}
                  {item.story && <small className="item-tag">线索</small>}
                </article>
              );
            })}
          </div>
        </div>
      ) : tab === 'shelter' ? (
        <div className="shelter-content">
          <p className="panel-note">这间旧公寓不是堡垒。每一处改造都只是多争取一点时间。</p>
          <dl className="shelter-list">
            <div><dt>结构完整度</dt><dd>{state.shelter.integrity} / 100</dd></div>
            <div><dt>门窗加固</dt><dd>等级 {state.shelter.reinforcement}</dd></div>
            {state.difficulty === 'hard' && <div><dt>波次吸收</dt><dd>{siegeMitigation(state)} 点 / 波</dd></div>}
            <div><dt>可饮用净水</dt><dd>{state.shelter.water} 单位</dd></div>
            <div><dt>待净化原水</dt><dd>{state.shelter.rawWater} 单位</dd></div>
            <div><dt>备用电力</dt><dd>{state.shelter.power} 单位</dd></div>
            <div><dt>燃料储备</dt><dd>{state.shelter.fuel} 单位</dd></div>
            <div><dt>供电改造</dt><dd>等级 {state.shelter.generator}</dd></div>
            <div><dt>电力陷阱</dt><dd>{state.powerTrap.level ? `${powerTrapDefinition(state.powerTrap.level)?.name} · ${state.powerTrap.armed ? '已接通' : '已断开'}` : '未安装'}</dd></div>
            <div><dt>燃油发电机</dt><dd>{inventoryCount(state.inventory, 'fuel-generator') > 0 ? '已购置 · 3 燃料 / 5 电力' : '未购置 · 无法燃油发电'}</dd></div>
            <div><dt>今夜负载</dt><dd>{powerPolicy.name} · {powerBudget.totalSpend} 电（策略 {powerBudget.policySpend}{powerBudget.weatherSpend ? ` / 暴雨 ${powerBudget.weatherSpend}` : ''}{powerBudget.trapSpend ? ` / 陷阱 ${powerBudget.trapSpend}` : ''}{powerBudget.alarmSpend ? ` / 警戒 ${powerBudget.alarmSpend}` : ''}）</dd></div>
            <div><dt>今夜后电量</dt><dd>{state.shelter.power === 0 ? '当前无可调度电力' : powerBudget.totalSpend > 0 ? `预计剩余 ${powerBudget.remaining}；后续波次另行预演` : '今夜无计划耗电；不代表后续波次无负载'}</dd></div>
            <div><dt>料理技能</dt><dd>{state.cookingSkill} / 5 级 · 尝试 {state.cookingAttempts} 次</dd></div>
            <div><dt>饮食厌倦</dt><dd>{state.foodBoredom} / 100 · 扩大菜单可有限缓解</dd></div>
            <div><dt>娱乐储备</dt><dd>{['paperback', 'playing-cards', 'music-player'].filter((id) => inventoryCount(state.inventory, id) > 0).length} / 3 种</dd></div>
            <div><dt>最近进食</dt><dd title={state.recentMeals.map((id) => ITEM_MAP[id]?.name ?? id).join(' → ') || '尚无记录'}>{state.recentMeals.length ? state.recentMeals.slice(-3).map((id) => ITEM_MAP[id]?.name ?? id).join(' → ') : '尚无记录'}</dd></div>
          </dl>
          <section className="furniture-section" aria-labelledby="furniture-title">
            <div className="furniture-heading"><span className="section-kicker">BUILT-IN FURNITURE</span><h2 id="furniture-title">自带家具</h2></div>
            <div className="furniture-list">
              {FURNITURE.map((furniture) => {
                const unit = state.furniture[furniture.id];
                const powerBlocked = state.phase === 'survival' && ['fridge', 'microwave', 'electric-hotpot'].includes(furniture.id) && state.shelter.power === 0;
                return (
                  <article key={furniture.id}>
                    <header><strong>{furniture.name}</strong><span className={powerBlocked ? 'offline' : 'online'}>{powerBlocked ? '停电' : unit.enabled ? '可用' : '关闭'}</span></header>
                    <p>{furniture.description}</p>
                    <small>{furniture.cost}</small><small>{furniture.benefit}</small>
                  </article>
                );
              })}
            </div>
          </section>
          <div className="shelter-warning">
            <span>夜间压力</span>
            <p>{state.shelter.integrity < 30 ? '结构已接近失守，优先修缮。' : state.shelter.power === 0 ? '完全停电会持续损耗精神。' : '当前尚能维持基本防护。'}</p>
          </div>
        </div>
      ) : (
        <div className="archive-content">
          <section className="archive-section">
            <div className="archive-heading"><span className="section-kicker">CLUE ARCHIVE</span><h2>当前线索</h2><b>{CLUES.filter((clue) => isClueDiscovered(state, clue)).length}/{CLUES.length}</b></div>
            <div className="archive-list">{CLUES.map((clue) => {
              const discovered = isClueDiscovered(state, clue);
              return <article key={clue.id} className={discovered ? 'discovered' : 'locked'}><header><strong>{discovered ? clue.name : '尚未确认的线索'}</strong>{clue.evidence && <span>证据</span>}</header><p>{discovered ? clue.description : `来源提示：${clue.source}`}</p><small>{discovered ? `来源：${clue.source}` : '继续广播、事件或地点探索以解锁'}</small></article>;
            })}</div>
          </section>
          <section className="archive-section recipe-archive">
            <div className="archive-heading"><span className="section-kicker">RECIPE NOTEBOOK</span><h2>配方图鉴</h2><b>{state.discoveredRecipes.length}/{RECIPES.length}</b></div>
            <div className="archive-list">{RECIPES.map((recipe) => {
              const discovered = state.discoveredRecipes.includes(recipe.id);
              return <article key={recipe.id} className={discovered ? 'discovered' : 'locked'}><header><strong>{discovered ? recipe.name : '未发现配方'}</strong><span>{recipe.appliance === 'gas-stove' ? '燃气炉' : recipe.appliance === 'microwave' ? '微波炉' : '电火锅'}</span></header><p>{discovered ? Object.entries(recipe.ingredients).map(([itemId, quantity]) => `${ITEM_MAP[itemId]?.name ?? itemId} ×${quantity}`).join(' + ') : '用自选食材成功做出后，完整组合会记录在这里。'}</p>{discovered && <small>用水 {recipe.water} · 耗能 {recipe.energy} · {recipe.description}</small>}</article>;
            })}</div>
          </section>
        </div>
      )}
    </aside>
  );
}
