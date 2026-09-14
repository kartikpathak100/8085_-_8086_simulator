import React, { useRef } from 'react';
import { T, mono } from './theme.js';

/* --------------------------------- button -------------------------------- */
export function Btn({ icon: Icon, label, onClick, disabled, active, title, tone }) {
  const color = active ? '#fff' : tone === 'danger' ? T.red : tone === 'quiet' ? T.dim : T.text;
  return (
    <button
      type="button"
      title={title || label}
      aria-label={title || label}
      aria-pressed={active ? true : undefined}
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-2.5 rounded-[3px] transition-colors disabled:opacity-35 disabled:cursor-not-allowed hover:brightness-125"
      style={{
        ...mono,
        height: 28,
        fontSize: 'var(--fs-sm)',
        background: active ? T.accent : T.panel,
        color,
        border: `1px solid ${active ? T.accent : T.line}`,
      }}
    >
      {Icon && <Icon size={13} />}
      {label && <span>{label}</span>}
    </button>
  );
}

/* --------------------------------- select -------------------------------- */
export function Select({ value, onChange, options, title, width, label }) {
  return (
    <label className="flex items-center gap-1.5" title={title}>
      {label && <span style={{ ...mono, fontSize: 'var(--fs-xs)', color: T.dim }}>{label}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-[3px] px-1.5 outline-none cursor-pointer"
        style={{
          ...mono, height: 28, fontSize: 'var(--fs-sm)', width,
          background: T.panel, color: T.text, border: `1px solid ${T.line}`,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ background: T.panel }}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

/* ------------------------------ segmented set ---------------------------- */
export function Segmented({ value, onChange, options, title }) {
  return (
    <div className="flex rounded-[3px] overflow-hidden" style={{ border: `1px solid ${T.line}` }} title={title} role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className="px-2.5"
          style={{
            ...mono, height: 26, fontSize: 'var(--fs-sm)',
            background: value === o.value ? T.accent : T.panel,
            color: value === o.value ? '#fff' : T.dim,
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------- panel -------------------------------- */
export function Panel({ title, hint, icon: Icon, right, children, style, flush }) {
  return (
    <section className="flex flex-col min-h-0 min-w-0 h-full" style={{ background: T.deep, ...style }}>
      {title && (
        <header
          className="flex items-center gap-2 px-2.5 shrink-0"
          style={{ height: 30, background: T.headerGrad, borderBottom: `1px solid ${T.line}` }}
        >
          {Icon && <Icon size={13} style={{ color: T.dim }} />}
          <span style={{ ...mono, fontSize: 'var(--fs)', color: T.text }}>{title}</span>
          {hint && <span className="truncate" style={{ ...mono, fontSize: 'var(--fs-xs)', color: T.dimmer }}>{hint}</span>}
          <div className="ml-auto flex items-center gap-1.5">{right}</div>
        </header>
      )}
      <div className={`flex-1 min-h-0 min-w-0 ${flush ? '' : 'overflow-auto'}`}>{children}</div>
    </section>
  );
}

/* ----------------------------------- tab --------------------------------- */
export function Tab({ active, onClick, icon: Icon, label, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className="flex items-center gap-1.5 px-3 shrink-0"
      style={{
        ...mono, height: 30, fontSize: 'var(--fs-sm)',
        color: active ? T.white : T.dim,
        background: active ? T.deep : 'transparent',
        borderBottom: `2px solid ${active ? T.accent : 'transparent'}`,
      }}
    >
      <Icon size={13} />
      {label}
      {badge != null && (
        <span style={{ fontSize: 'var(--fs-xs)', color: T.dimmer }}>{badge}</span>
      )}
    </button>
  );
}

/* -------------------------------- splitter ------------------------------- */
/** Draggable divider. Drag, double-click to reset, or focus and use arrow keys. */
export function Splitter({ axis = 'x', onDelta, onReset, label }) {
  const last = useRef(0);
  const horizontal = axis === 'x';

  const start = (e) => {
    e.preventDefault();
    last.current = horizontal ? e.clientX : e.clientY;
    const move = (ev) => {
      const p = horizontal ? ev.clientX : ev.clientY;
      onDelta(p - last.current);
      last.current = p;
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    document.body.style.cursor = horizontal ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  };

  const key = (e) => {
    const step = e.shiftKey ? 40 : 12;
    if (horizontal && e.key === 'ArrowLeft') { e.preventDefault(); onDelta(-step); }
    if (horizontal && e.key === 'ArrowRight') { e.preventDefault(); onDelta(step); }
    if (!horizontal && e.key === 'ArrowUp') { e.preventDefault(); onDelta(-step); }
    if (!horizontal && e.key === 'ArrowDown') { e.preventDefault(); onDelta(step); }
    if (e.key === 'Enter') { e.preventDefault(); onReset && onReset(); }
  };

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation={horizontal ? 'vertical' : 'horizontal'}
      aria-label={label || 'Resize panels'}
      title="Drag to resize · double-click to reset"
      onPointerDown={start}
      onDoubleClick={onReset}
      onKeyDown={key}
      className="group shrink-0 flex items-center justify-center"
      style={{
        width: horizontal ? 6 : '100%',
        height: horizontal ? '100%' : 6,
        cursor: horizontal ? 'col-resize' : 'row-resize',
        background: T.base,
        touchAction: 'none',
      }}
    >
      <span
        className="splitter-grip rounded-full"
        style={{ width: horizontal ? 2 : 26, height: horizontal ? 26 : 2 }}
      />
    </div>
  );
}

/* ------------------------------- small bits ------------------------------ */
export function Chip({ label, value, color, title }) {
  return (
    <div
      className="flex items-baseline gap-1.5 px-2 rounded-[3px] shrink-0"
      title={title}
      style={{ height: 28, lineHeight: '28px', background: T.panel, border: `1px solid ${T.line}` }}
    >
      <span style={{ ...mono, fontSize: 'var(--fs-xs)', color: T.dim }}>{label}</span>
      <span style={{ ...mono, fontSize: 'var(--fs-sm)', color: color || T.white }}>{value}</span>
    </div>
  );
}

export function Empty({ children }) {
  return (
    <div className="h-full flex items-center justify-center p-6 text-center">
      <p style={{ ...mono, fontSize: 'var(--fs)', color: T.dimmer, maxWidth: 420, lineHeight: 1.6 }}>{children}</p>
    </div>
  );
}
