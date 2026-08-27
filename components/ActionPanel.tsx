'use client';

import { useEffect } from 'react';

export interface ActionChoice {
  id: string;
  label: string;
  hint: string;
  disabledReason?: string | null;
  danger?: string;
  onSelect: () => void;
}

export function ActionPanel({ title, subtitle, choices, shortcuts }: {
  title: string;
  subtitle?: string;
  choices: ActionChoice[];
  shortcuts: boolean;
}) {
  useEffect(() => {
    if (!shortcuts) return;
    const listener = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (document.querySelector('[role="dialog"]')) return;
      const index = Number(event.key) - 1;
      if (index >= 0 && index < choices.length && !choices[index].disabledReason) {
        event.preventDefault();
        choices[index].onSelect();
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [choices, shortcuts]);

  return (
    <section className="action-panel" aria-labelledby="action-title">
      <header className="action-panel-head">
        <div><span className="section-kicker">AVAILABLE ACTIONS</span><h2 id="action-title">{title}</h2></div>
        {subtitle && <p>{subtitle}</p>}
      </header>
      <div className="choice-grid">
        {choices.slice(0, 9).map((choice, index) => {
          const disabled = Boolean(choice.disabledReason);
          return (
            <button
              key={choice.id}
              type="button"
              className={`choice-button ${disabled ? 'disabled' : ''}`}
              aria-disabled={disabled}
              data-choice={index + 1}
              onClick={() => !disabled && choice.onSelect()}
            >
              <kbd>{index + 1}</kbd>
              <span className="choice-copy">
                <strong>{choice.label}</strong>
                <small>{choice.disabledReason ?? choice.hint}</small>
              </span>
              {choice.danger && <em className="danger-tag">{choice.danger}</em>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
