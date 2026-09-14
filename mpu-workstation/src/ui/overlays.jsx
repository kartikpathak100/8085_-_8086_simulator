import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X, Keyboard } from 'lucide-react';
import { T, mono } from './theme.js';

/* --------------------------------- toasts -------------------------------- */
export function Toasts({ items, dismiss }) {
  return (
    <div className="fixed bottom-8 right-4 flex flex-col gap-2 z-50" style={{ maxWidth: 340 }}>
      {items.map((t) => {
        const Icon = t.kind === 'err' ? AlertTriangle : t.kind === 'ok' ? CheckCircle2 : Info;
        const colour = t.kind === 'err' ? T.red : t.kind === 'ok' ? T.green : T.accentText;
        return (
          <div
            key={t.id}
            role="status"
            className="anim-toast flex items-start gap-2.5 px-3 py-2.5 rounded-md"
            style={{ background: T.panel, border: `1px solid ${T.line}`, boxShadow: T.shadowFloat }}
          >
            <Icon size={14} style={{ color: colour, marginTop: 1, flexShrink: 0 }} />
            <span style={{ ...mono, fontSize: 'var(--fs-sm)', color: T.text, lineHeight: 1.5 }}>{t.text}</span>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss"
              style={{ color: T.dimmer, marginLeft: 'auto' }}>
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------- dialog -------------------------------- */
export function Dialog({ title, onClose, children, width = 460 }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', animation: 'fadein 160ms ease-out' }}
      onClick={onClose}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="anim-pop rounded-lg outline-none"
        style={{ width, maxWidth: '100%', background: T.panel, border: `1px solid ${T.line}`, boxShadow: T.shadowFloat }}
      >
        <header className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${T.lineSoft}` }}>
          <span style={{ ...mono, fontSize: 'var(--fs-lg)', color: T.white }}>{title}</span>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto" style={{ color: T.dim }}>
            <X size={14} />
          </button>
        </header>
        <div className="px-4 py-3">{children}</div>
      </div>
    </div>
  );
}

const KEYS = [
  ['F5', 'Run or pause'],
  ['F10', 'Step forward one instruction'],
  ['F8', 'Step backward one instruction'],
  ['Ctrl / ⌘ + Enter', 'Assemble the program'],
  ['Ctrl / ⌘ + O', 'Open an .asm file'],
  ['Ctrl / ⌘ + S', 'Save your program'],
  ['?', 'Show this list'],
];

export function ShortcutsDialog({ onClose }) {
  return (
    <Dialog title="Keyboard shortcuts" onClose={onClose}>
      <div className="flex items-center gap-2 mb-3" style={{ color: T.dim }}>
        <Keyboard size={13} />
        <span style={{ ...mono, fontSize: 'var(--fs-xs)' }}>Works anywhere except while typing in a text box.</span>
      </div>
      <table className="w-full" style={{ ...mono, fontSize: 'var(--fs-sm)' }}>
        <tbody>
          {KEYS.map(([k, what]) => (
            <tr key={k}>
              <td className="py-1.5 pr-4" style={{ width: 140 }}>
                <kbd className="px-2 py-1 rounded"
                  style={{ background: T.rail, border: `1px solid ${T.line}`, color: T.accentText }}>{k}</kbd>
              </td>
              <td style={{ color: T.text }}>{what}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Dialog>
  );
}

/* ------------------------------- menu button ----------------------------- */
export function Menu({ label, icon: Icon, children, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('pointerdown', away); window.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="press flex items-center gap-1.5 px-2.5 rounded-[3px]"
        style={{
          ...mono, height: 28, fontSize: 'var(--fs-sm)',
          background: open ? T.accent : T.panel, color: open ? '#fff' : T.text,
          border: `1px solid ${open ? T.accent : T.line}`,
        }}
      >
        {Icon && <Icon size={13} />}
        {label}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute z-40 mt-1 py-1.5 rounded-md anim-pop"
          style={{
            [align]: 0, minWidth: 210, background: T.panel,
            border: `1px solid ${T.line}`, boxShadow: T.shadowFloat,
          }}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ icon: Icon, label, hint, checked, onClick }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="menu-item w-full flex items-center gap-2.5 px-3 py-1.5 text-left"
      style={{ ...mono, fontSize: 'var(--fs-sm)', color: T.text, background: 'transparent' }}
    >
      {checked !== undefined && (
        <span
          style={{
            width: 12, height: 12, borderRadius: 3, flexShrink: 0,
            background: checked ? T.accent : 'transparent',
            border: `1px solid ${checked ? T.accent : T.dimmer}`,
          }}
        />
      )}
      {Icon && <Icon size={13} style={{ color: T.dim }} />}
      <span>{label}</span>
      {hint && <span className="ml-auto" style={{ color: T.dimmer, fontSize: 'var(--fs-xs)' }}>{hint}</span>}
    </button>
  );
}
