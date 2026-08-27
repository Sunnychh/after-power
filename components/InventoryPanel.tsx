'use client';

import { useState } from 'react';
import { CATEGORY_ORDER, formatItemEffects, ITEM_MAP } from '../game/data/items.ts';
import { FURNITURE } from '../game/data/furniture.ts';
import { batchExpiryStatus, inventoryCount } from '../game/engine/inventory.ts';
import { inventorySummary } from '../game/engine/actions.ts';
import { absoluteDay } from '../game/engine/state.ts';
import type { GameState } from '../game/types.ts';
import { POWER_POLICY_MAP } from '../game/data/power.ts';
import { projectedPowerNights } from '../game/engine/power.ts';
import { siegeMitigation } from '../game/engine/siege.ts';

export function InventoryPanel({ state, open, onClose, onUse }: {
  state: GameState;
  open: boolean;
  onClose: () => void;
  onUse: (itemId: string) => void;
}) {
  const [tab, setTab] = useState<'inventory' | 'shelter'>('inventory');
  const summary = inventorySummary(state);
  const currentDay = absoluteDay(state);
  const powerPolicy = POWER_POLICY_MAP[state.powerPolicy];
  const alarmCost = state.phase === 'survival' && state.difficulty === 'hard' && state.survivalDay >= 8 ? 1 : 0;
  const powerNights = projectedPowerNights(state);
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
              return (
                <article className="item-row" key={item.id}>
                  <div className="item-main">
                    <div>
                      <strong>{item.name} <em>×{inventoryCount(state.inventory, item.id)}</em></strong>
                      <span className={`category-pill category-${item.category}`}>{item.category}</span>
                      {effects.length > 0 && <span className="effect-list">{effects.map((effect) => <i key={effect}>{effect}</i>)}</span>}
                      <span className="item-description">{item.description}</span>
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
      ) : (
        <div className="shelter-content">
          <p className="panel-note">这间旧公寓不是堡垒。每一处改造都只是多争取一点时间。</p>
          <dl className="shelter-list">
            <div><dt>结构完整度</dt><dd>{state.shelter.integrity} / 100</dd></div>
            <div><dt>门窗加固</dt><dd>等级 {state.shelter.reinforcement}</dd></div>
            {state.difficulty === 'hard' && <div><dt>波次吸收</dt><dd>{siegeMitigation(state)} 点 / 波</dd></div>}
            <div><dt>可用储水</dt><dd>{state.shelter.water} 单位</dd></div>
            <div><dt>备用电力</dt><dd>{state.shelter.power} 单位</dd></div>
            <div><dt>燃料储备</dt><dd>{state.shelter.fuel} 单位</dd></div>
            <div><dt>供电改造</dt><dd>等级 {state.shelter.generator}</dd></div>
            <div><dt>夜间负载</dt><dd>{powerPolicy.name} · 约 {powerPolicy.expectedPower + alarmCost} 电/夜{alarmCost ? '（含警戒）' : ''}</dd></div>
            <div><dt>预计续航</dt><dd>{powerNights === null ? '已关闭供电' : `约 ${powerNights} 夜`}</dd></div>
            <div><dt>料理技能</dt><dd>{state.cookingSkill} / 5 级 · 尝试 {state.cookingAttempts} 次</dd></div>
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
      )}
    </aside>
  );
}
