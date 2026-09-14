import React from 'react';
import { X } from 'lucide-react';
import { T, mono } from './theme.js';

/**
 * The right-hand dock. Panels only exist here once you switch them on, and each
 * one can be closed from its own tab.
 */
export default function Dock({ panels, active, setActive, onClose }) {
  if (!panels.length) return null;
  const current = panels.find((p) => p.id === active) || panels[0];

  return (
    <div className="h-full flex flex-col min-w-0 anim-dock" style={{ background: T.deep }}>
      <div
        className="flex shrink-0 overflow-x-auto"
        role="tablist"
        style={{ background: T.headerGrad, borderBottom: `1px solid ${T.line}` }}
      >
        {panels.map((p) => {
          const on = p.id === current.id;
          const Icon = p.icon;
          return (
            <div
              key={p.id}
              className="flex items-center shrink-0"
              style={{
                background: on ? T.deep : 'transparent',
                borderBottom: `2px solid ${on ? T.accent : 'transparent'}`,
              }}
            >
              <button
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setActive(p.id)}
                className="flex items-center gap-1.5 pl-3 pr-1.5"
                style={{ ...mono, height: 30, fontSize: 'var(--fs-sm)', color: on ? T.white : T.dim }}
              >
                <Icon size={13} />
                {p.title}
              </button>
              <button
                type="button"
                onClick={() => onClose(p.id)}
                aria-label={`Close ${p.title}`}
                title={`Close ${p.title}`}
                className="pr-2 pl-0.5"
                style={{ color: T.dimmer, height: 30 }}
              >
                <X size={11} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex-1 min-h-0" key={current.id}>
        {current.render()}
      </div>
    </div>
  );
}
