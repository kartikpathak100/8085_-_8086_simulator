import React from 'react';
import { T, mono } from './theme.js';
import { hex } from '../core/utils.js';
import { phys } from '../core/machine.js';
import { Empty } from './primitives.jsx';

export default function StackView({ arch, cpu, mem, lastWrites }) {
  const sp = cpu.regs.SP;
  const wordMode = arch === '8086';
  const step = wordMode ? 2 : 1;
  const base = arch === '8085' ? 0 : phys(cpu.regs.SS, 0);
  const top = arch === '8085' ? 0xffff : 0xfffe;

  const rows = [];
  for (let i = 0; i < 18; i++) {
    const off = (sp + i * step) & 0xffff;
    if (off > top) break;
    const addr = base + off;
    const val = wordMode ? mem[addr] | (mem[addr + 1] << 8) : mem[addr];
    rows.push({ off, addr, val, isTop: i === 0, fresh: lastWrites.has(addr) });
  }

  const depth = (top - sp + 1) & 0xffff;
  if (!rows.length) return <Empty>The stack is empty. Run a PUSH or CALL and the saved values appear here.</Empty>;

  return (
    <div className="h-full overflow-auto p-2.5">
      <div className="flex flex-wrap items-center gap-4 mb-2.5"
        style={{ ...mono, fontSize: 'var(--fs-xs)', color: T.dim }}>
        <span>Top of stack: <span style={{ color: T.white }}>{hex(sp, 4)}H</span></span>
        <span>In use: <span style={{ color: T.white }}>{depth}</span> bytes</span>
        <span>{wordMode ? `Stack segment ${hex(cpu.regs.SS, 4)}H` : 'Grows downwards from FFFFH'}</span>
      </div>
      <div className="flex flex-col gap-[3px]" style={{ maxWidth: 440 }}>
        {rows.map((r) => (
          <div
            key={r.off}
            className="flex items-center gap-2.5 px-2.5 rounded-[3px]"
            style={{
              height: 24,
              background: r.fresh ? T.hl : r.isTop ? T.panel : T.rail,
              border: `1px solid ${r.isTop ? T.accent : T.lineSoft}`,
              animation: r.fresh ? 'stackpush 320ms ease-out' : undefined,
              ...mono, fontSize: 'var(--fs-sm)',
            }}
          >
            <span style={{ color: r.isTop ? T.accentText : T.dimmer, width: 30 }}>{r.isTop ? 'SP▸' : ''}</span>
            <span style={{ color: T.dim, width: 52 }}>{hex(r.off, 4)}</span>
            <span style={{ color: T.white }}>{hex(r.val, wordMode ? 4 : 2)}</span>
            <span className="ml-auto" style={{ color: T.dimmer }}>
              {wordMode ? r.val : String.fromCharCode(r.val >= 32 && r.val < 127 ? r.val : 46)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
