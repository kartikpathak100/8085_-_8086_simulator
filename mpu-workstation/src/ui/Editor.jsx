import React, { useMemo, useRef, useEffect } from 'react';
import { T, MONO, mono } from './theme.js';
import { MNEMONICS, REGNAMES, DIRECTIVES } from '../core/syntax.js';

function tokens(line, arch) {
  const out = [];
  let text = line, comment = null;
  const ci = text.indexOf(';');
  if (ci >= 0) { comment = text.slice(ci); text = text.slice(0, ci); }

  const re = /('[^']*'|"[^"]*"|[A-Za-z_][A-Za-z0-9_]*:?|[0-9][0-9A-Za-z]*|\s+|.)/g;
  const parts = text.match(re) || [];
  let seenMnemonic = false;

  parts.forEach((tk, i) => {
    if (/^\s+$/.test(tk)) { out.push(tk); return; }
    const up = tk.toUpperCase();
    let color = T.text;
    if (tk[0] === "'" || tk[0] === '"') color = T.orange;
    else if (tk.endsWith(':')) color = T.amber;
    else if (DIRECTIVES.has(up)) color = T.purple;
    else if (!seenMnemonic && MNEMONICS[arch].has(up)) { color = T.blue; seenMnemonic = true; }
    else if (REGNAMES[arch].has(up)) color = T.ident;
    else if (/^[0-9]/.test(tk)) color = T.number;
    else if (/^[A-Za-z_]/.test(tk)) color = T.amber;
    else color = T.dimmer;
    out.push(<span key={i} style={{ color }}>{tk}</span>);
  });

  if (comment) out.push(<span key="c" style={{ color: T.comment }}>{comment}</span>);
  return out;
}

export default function Editor({
  code, setCode, arch, activeLine, breakpoints, toggleBreakpoint, errorLines, lh, fs, readOnly,
}) {
  const lines = useMemo(() => code.split('\n'), [code]);
  const scrollRef = useRef(null);
  const font = { fontFamily: MONO, fontSize: fs, lineHeight: `${lh}px` };

  const painted = useMemo(
    () => lines.map((l, i) => <div key={i} style={{ height: lh }}>{tokens(l, arch)}{'\u200b'}</div>),
    [lines, arch, lh]
  );

  useEffect(() => {
    if (activeLine == null || !scrollRef.current) return;
    const el = scrollRef.current;
    const top = activeLine * lh;
    if (top < el.scrollTop + lh || top > el.scrollTop + el.clientHeight - lh * 3) {
      el.scrollTop = Math.max(0, top - el.clientHeight / 2);
    }
  }, [activeLine, lh]);

  return (
    <div ref={scrollRef} className="h-full overflow-auto" style={{ background: T.deep }}>
      <div className="flex" style={{ minHeight: '100%' }}>
        <div
          className="sticky left-0 z-20 select-none shrink-0"
          style={{ width: 3.4 * fs, background: T.rail, borderRight: `1px solid ${T.line}` }}
        >
          {lines.map((_, i) => {
            const bp = breakpoints.has(i);
            const act = i === activeLine;
            return (
              <div
                key={i}
                onClick={() => toggleBreakpoint(i)}
                title={bp ? 'Remove breakpoint' : 'Click to pause here when running'}
                className="flex items-center justify-end gap-1 pr-1.5 cursor-pointer"
                style={{
                  height: lh, ...mono, fontSize: fs - 1,
                  color: act ? T.accentText : errorLines.has(i) ? T.red : T.dimmer,
                  background: act ? T.hlSoft : 'transparent',
                }}
              >
                {bp && <span style={{ width: 7, height: 7, borderRadius: 7, background: T.red }} />}
                {act && !bp && <span style={{ color: T.accentText }}>▸</span>}
                {i + 1}
              </div>
            );
          })}
        </div>

        <div className="relative flex-1" style={{ minWidth: 420 }}>
          {activeLine != null && (
            <div
              className="absolute left-0 right-0"
              style={{
                top: activeLine * lh, height: lh,
                background: T.hlSoft, borderLeft: `2px solid ${T.accent}`,
              }}
            />
          )}
          {[...errorLines].map((ln) => (
            <div key={ln} className="absolute left-0 right-0"
              style={{ top: ln * lh, height: lh, background: T.errWash }} />
          ))}
          <pre aria-hidden className="relative m-0" style={{ ...font, padding: '0 10px', whiteSpace: 'pre' }}>
            {painted}
          </pre>
          <textarea
            value={code}
            spellCheck={false}
            wrap="off"
            readOnly={readOnly}
            aria-label="Assembly source code"
            onChange={(e) => setCode(e.target.value)}
            className="absolute top-0 left-0 w-full outline-none resize-none"
            style={{
              ...font, padding: '0 10px', height: lines.length * lh,
              background: 'transparent', color: 'transparent', caretColor: T.white,
              border: 'none', whiteSpace: 'pre', overflow: 'hidden',
            }}
          />
        </div>
      </div>
    </div>
  );
}
