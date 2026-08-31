'use client';

import { useId, type KeyboardEvent } from 'react';
import type { DeepMapNodeSummary, DeepMapSummary } from '../game/engine/deep-map.ts';

export interface DeepMapProps {
  summary: DeepMapSummary;
  discoveredSceneIds: readonly string[] | ReadonlySet<string>;
  onNavigate: (sceneId: string) => void;
  /** Return a reason to keep an adjacent destination visible but disabled. */
  navigationDisabledReason?: (node: DeepMapNodeSummary) => string | null | undefined;
  navigationHint?: string;
}

function keyboardNavigate(event: KeyboardEvent<HTMLElement>) {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
  const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-deep-map-navigate]:not(:disabled)')];
  if (!buttons.length) return;

  const activeIndex = buttons.findIndex((button) => button === document.activeElement);
  let nextIndex = activeIndex;
  if (event.key === 'Home') nextIndex = 0;
  else if (event.key === 'End') nextIndex = buttons.length - 1;
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = activeIndex <= 0 ? buttons.length - 1 : activeIndex - 1;
  else nextIndex = activeIndex < 0 || activeIndex === buttons.length - 1 ? 0 : activeIndex + 1;

  event.preventDefault();
  buttons[nextIndex]?.focus();
}

export function DeepMap({
  summary,
  discoveredSceneIds,
  onNavigate,
  navigationDisabledReason,
  navigationHint = '10分钟 · 体力 -1',
}: DeepMapProps) {
  const titleId = useId();
  const discovered = new Set(discoveredSceneIds);
  const nodesById = new Map(summary.nodes.map((node) => [node.sceneId, node]));
  const knownNodes = summary.nodes.filter((node) => discovered.has(node.sceneId) || node.status === 'current');
  const knownTargetTotal = knownNodes.reduce((sum, node) => sum + node.totalTargets, 0);
  const knownTargetProcessed = knownNodes.reduce((sum, node) => sum + node.processedTargets, 0);

  const nodeName = (node: DeepMapNodeSummary) => node.name;

  const routeLabel = summary.pathToEntrance.map((sceneId) => {
    const node = nodesById.get(sceneId);
    return node ? nodeName(node) : '路线中断';
  }).join('，然后 ');

  return (
    <section className="deep-map" aria-labelledby={titleId}>
      <header className="deep-map__header">
        <div>
          <span className="section-kicker">ROUTE OVERVIEW</span>
          <h3 id={titleId}>{summary.locationName} · 路线示意</h3>
        </div>
        <p className="deep-map__summary">
          已发现 {discovered.size}/{summary.nodes.length} 个区域 · 已知目标 {knownTargetProcessed}/{knownTargetTotal}
        </p>
      </header>

      <p className="deep-map__note">这是按入口最短路线整理的区域图，不代表真实方位。手动移动每段耗时 10 分钟；撤离时会沿返程参考自动折返，室内返路已计入固定回程窗口。</p>

      <ul className="deep-map__legend" aria-label="地图图例">
        <li>当前位置</li>
        <li>已发现</li>
        <li>未发现</li>
        <li>可直达</li>
        <li>入口 / 撤离点</li>
      </ul>

      <aside className="deep-map__return" aria-label="返程路线">
        <strong>返程参考</strong>
        <span>{summary.stepsToEntrance === 0 ? '你就在入口，可以撤离' : `距入口 ${summary.stepsToEntrance} 段 · 手动折返约 ${summary.stepsToEntrance * 10} 分钟`}</span>
        {routeLabel && <p>{routeLabel}</p>}
      </aside>

      <nav className="deep-map__navigation" aria-label={`${summary.locationName}内部路线`} onKeyDown={keyboardNavigate}>
        <ol className="deep-map__rows">
          {summary.layers.map((row, depth) => (
            <li className="deep-map__row" key={depth} data-depth={depth}>
              <p className="deep-map__row-label">{depth === 0 ? '入口层' : `距入口 ${depth} 段路线`}</p>
              <ul className="deep-map__nodes">
                {row.map((node) => {
                  const isCurrent = node.status === 'current';
                  const isDirect = node.status === 'adjacent';
                  const isDiscovered = discovered.has(node.sceneId) || isCurrent;
                  const disabledReason = isDirect ? navigationDisabledReason?.(node) : undefined;
                  const connectionLabels = node.connections.map((sceneId) => {
                    const connection = nodesById.get(sceneId);
                    return connection ? nodeName(connection) : '无效路线';
                  });
                  const stateClass = isCurrent ? 'current' : isDiscovered ? 'discovered' : 'undiscovered';

                  return (
                    <li
                      className={`deep-map__node deep-map__node--${stateClass}${isDirect ? ' deep-map__node--direct' : ''}`}
                      data-scene-id={node.sceneId}
                      data-state={stateClass}
                      key={node.sceneId}
                      aria-current={isCurrent ? 'location' : undefined}
                    >
                      <article className="deep-map__node-card">
                        <header className="deep-map__node-header">
                          <h4>{nodeName(node)}</h4>
                        </header>

                        <ul className="deep-map__node-tags" aria-label="区域状态">
                          {isCurrent && <li>当前位置</li>}
                          {isDirect && <li>可直达</li>}
                          {node.isEntrance && <li>入口</li>}
                          {node.isEntrance && <li>撤离点</li>}
                          {isDiscovered ? <li>已发现</li> : <li>未发现</li>}
                        </ul>

                        <p className="deep-map__connections">
                          <span>连接：</span>{connectionLabels.length ? connectionLabels.join('、') : '无已知连接'}
                        </p>

                        {isDiscovered ? (
                          <div className="deep-map__target-progress">
                            <label htmlFor={`${titleId}-${node.sceneId}-progress`}>目标 {node.processedTargets}/{node.totalTargets}</label>
                            <progress
                              id={`${titleId}-${node.sceneId}-progress`}
                              max={Math.max(1, node.totalTargets)}
                              value={node.processedTargets}
                            >
                              {node.processedTargets}/{node.totalTargets}
                            </progress>
                          </div>
                        ) : <p className="deep-map__targets-unknown">目标：尚未侦察</p>}

                        {isDirect && (
                          <button
                            type="button"
                            className="deep-map__navigate"
                            data-deep-map-navigate
                            disabled={Boolean(disabledReason)}
                            title={disabledReason ?? navigationHint}
                            aria-label={`前往${node.name}。${disabledReason ?? navigationHint}`}
                            onClick={() => !disabledReason && onNavigate(node.sceneId)}
                          >
                            前往 {node.name}
                            <small>{disabledReason ?? navigationHint}</small>
                          </button>
                        )}
                        {!isCurrent && !isDirect && <p className="deep-map__route-lock">需从相邻区域逐段前往</p>}
                      </article>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      </nav>
      <p className="deep-map__keyboard-help">Tab 聚焦路线；Enter 或空格确认；方向键在可直达路线间切换。</p>
    </section>
  );
}
