import React, { useRef, useEffect } from 'react';
import { T, mono } from './theme.js';
import { hex } from '../core/utils.js';
import { Empty } from './primitives.jsx';

export default function Disassembly({ prog, pc, breakpoints, onToggleBreakpoint, lh }) {
  const boxRef = useRef(null);
  const rows = prog.instructions;
  const activeIdx = rows.findIndex((r) => !r.isData && r.addr === pc);

  useEffect(() => {
    if (activeIdx < 0 || !boxRef.current) return;
    const el = boxRef.current;
    const top = activeIdx * lh;
    if (top < el.scrollTop || top > el.scrollTop + el.clientHeight - lh * 2) {
      el.scrollTop = Math.max(0, top - el.clientHeight / 2);
    }
  }, [activeIdx, lh]);

  if (!rows.length) return <Empty>Press Assemble and the machine code for every line will appear here.</Empty>;

  return (
    <div ref={boxRef} className="h-full overflow-auto">
      <table className="w-full border-collapse" style={{ ...mono, fontSize: 'var(--fs-sm)' }}>
        <tbody>
          {rows.map((r, i) => {
            const active = i === activeIdx;
            return (
              <tr key={i} style={{ background: active ? T.hlSoft : 'transparent', height: lh }}>
                <td className="pl-2 pr-1 cursor-pointer" style={{ width: 14, color: T.red }}
                  onClick={() => onToggleBreakpoint(r.line)}>
                  {breakpoints.has(r.line) ? '●' : ''}
                </td>
                <td className="pr-3" style={{ width: 62, color: active ? T.accentText : T.dim }}>{hex(r.addr, 4)}</td>
                <td className="pr-3" style={{ width: 96, color: T.green, letterSpacing: '0.04em' }}>
                  {r.bytes.slice(0, 3).map((b) => hex(b)).join(' ')}{r.bytes.length > 3 ? '…' : ''}
                </td>
                <td className="pr-2" style={{ width: 58, color: r.isData ? T.purple : T.blue }}>{r.mnemonic}</td>
                <td style={{ color: T.text }}>{r.operands.join(', ')}</td>
                <td className="pr-2 text-right" style={{ width: 48, color: T.dimmer }}>
                  {r.isData ? `${r.bytes.length}B` : `${r.t}T`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
