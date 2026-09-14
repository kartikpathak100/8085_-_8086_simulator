import React, { useState } from 'react';
import { T, mono } from './theme.js';
import { hex, bin } from '../core/utils.js';
import { HL, BC, DE, phys, psw85 } from '../core/machine.js';

function Cell({ label, value, width = 4, changed, note }) {
  return (
    <div
      className="flex items-baseline gap-2 px-2 py-1.5 rounded-[3px]"
      style={{
        background: changed ? T.hl : T.panel,
        border: `1px solid ${changed ? T.accent : T.lineSoft}`,
        transition: 'background 220ms linear, border-color 220ms linear',
      }}
    >
      <span style={{ ...mono, fontSize: 'var(--fs-xs)', color: T.dim, width: 26 }}>{label}</span>
      <span style={{ ...mono, fontSize: 'var(--fs-lg)', color: T.white }}>{hex(value, width)}</span>
      <span className="ml-auto" style={{ ...mono, fontSize: 'var(--fs-xs)', color: T.dimmer }}>
        {note != null ? note : value}
      </span>
    </div>
  );
}

function Flag({ name, value, changed, meaning }) {
  return (
    <div
      title={meaning}
      className="flex flex-col items-center justify-center rounded-[3px]"
      style={{
        width: 34, height: 36,
        background: changed ? T.hl : value ? T.okWash : T.panel,
        border: `1px solid ${changed ? T.accent : value ? T.okLine : T.lineSoft}`,
        transition: 'background 220ms linear',
      }}
    >
      <span style={{ ...mono, fontSize: 'var(--fs-xs)', color: T.dim }}>{name}</span>
      <span style={{ ...mono, fontSize: 'var(--fs)', color: value ? T.green : T.dimmer }}>{value}</span>
    </div>
  );
}

const FLAGS85 = [
  ['S', 'Sign — the result looked negative'],
  ['Z', 'Zero — the result was exactly zero'],
  ['AC', 'Auxiliary carry — a carry out of bit 3'],
  ['P', 'Parity — the result had an even number of 1 bits'],
  ['CY', 'Carry — the result did not fit in 8 bits'],
];
const FLAGS86 = [
  ['O', 'Overflow — signed result went out of range'],
  ['D', 'Direction — string operations count downwards'],
  ['I', 'Interrupt enable'],
  ['T', 'Trap — single-step mode'],
  ['S', 'Sign — the result looked negative'],
  ['Z', 'Zero — the result was exactly zero'],
  ['A', 'Auxiliary carry — a carry out of bit 3'],
  ['P', 'Parity — even number of 1 bits'],
  ['C', 'Carry — the result did not fit'],
];

function Row({ label, seg, off, arch }) {
  const p = arch === '8086' ? phys(seg, off) : off & 0xffff;
  return (
    <div className="flex items-center gap-2 px-2 py-[3px]" style={{ ...mono, fontSize: 'var(--fs-sm)' }}>
      <span style={{ color: T.dim, width: 48 }}>{label}</span>
      {arch === '8086' && (
        <>
          <span style={{ color: T.purple }}>{hex(seg, 4)}</span>
          <span style={{ color: T.dimmer }}>:</span>
          <span style={{ color: T.blue }}>{hex(off, 4)}</span>
          <span style={{ color: T.dimmer }}>→</span>
        </>
      )}
      <span style={{ color: T.green }}>{hex(p, arch === '8086' ? 5 : 4)}H</span>
    </div>
  );
}

export default function Registers({ arch, cpu, diff, detailed }) {
  const r = cpu.regs, f = cpu.flags;
  const [seg, setSeg] = useState('1000');
  const [off, setOff] = useState('0100');
  const segV = parseInt(seg || '0', 16) & 0xffff;
  const offV = parseInt(off || '0', 16) & 0xffff;
  const both = (a, b) => diff.regs.has(a) || diff.regs.has(b);

  const on = (arch === '8085' ? FLAGS85 : FLAGS86).filter(([k]) => f[k]).map(([k]) => k);

  return (
    <div className="h-full overflow-auto">
      <div className="p-2 grid grid-cols-2 gap-1.5">
        {arch === '8085' ? (
          <>
            <div className="col-span-2">
              <Cell label="A" value={r.A} width={2} changed={diff.regs.has('A')} note={bin(r.A)} />
            </div>
            <Cell label="B" value={r.B} width={2} changed={diff.regs.has('B')} />
            <Cell label="C" value={r.C} width={2} changed={diff.regs.has('C')} />
            <Cell label="D" value={r.D} width={2} changed={diff.regs.has('D')} />
            <Cell label="E" value={r.E} width={2} changed={diff.regs.has('E')} />
            <Cell label="H" value={r.H} width={2} changed={diff.regs.has('H')} />
            <Cell label="L" value={r.L} width={2} changed={diff.regs.has('L')} />
            <Cell label="HL" value={HL(r)} changed={both('H', 'L')} note="pointer" />
            <Cell label="SP" value={r.SP} changed={diff.regs.has('SP')} note="stack" />
            <div className="col-span-2">
              <Cell label="PC" value={r.PC} changed={diff.regs.has('PC')} note="next instruction" />
            </div>
            {detailed && (
              <>
                <Cell label="BC" value={BC(r)} changed={both('B', 'C')} />
                <Cell label="DE" value={DE(r)} changed={both('D', 'E')} />
                <div className="col-span-2">
                  <Cell label="PSW" value={psw85(f)} width={2} changed={diff.flags.size > 0} note="flags byte" />
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <Cell label="AX" value={r.AX} changed={diff.regs.has('AX')} note={`${hex(r.AX >> 8)}·${hex(r.AX & 255)}`} />
            <Cell label="BX" value={r.BX} changed={diff.regs.has('BX')} note={`${hex(r.BX >> 8)}·${hex(r.BX & 255)}`} />
            <Cell label="CX" value={r.CX} changed={diff.regs.has('CX')} note={`${hex(r.CX >> 8)}·${hex(r.CX & 255)}`} />
            <Cell label="DX" value={r.DX} changed={diff.regs.has('DX')} note={`${hex(r.DX >> 8)}·${hex(r.DX & 255)}`} />
            <Cell label="SI" value={r.SI} changed={diff.regs.has('SI')} />
            <Cell label="DI" value={r.DI} changed={diff.regs.has('DI')} />
            <Cell label="SP" value={r.SP} changed={diff.regs.has('SP')} note="stack" />
            <Cell label="BP" value={r.BP} changed={diff.regs.has('BP')} />
            <div className="col-span-2">
              <Cell label="IP" value={r.IP} changed={diff.regs.has('IP')} note="next instruction" />
            </div>
            {detailed && (
              <>
                <Cell label="CS" value={r.CS} changed={diff.regs.has('CS')} note="code" />
                <Cell label="DS" value={r.DS} changed={diff.regs.has('DS')} note="data" />
                <Cell label="SS" value={r.SS} changed={diff.regs.has('SS')} note="stack" />
                <Cell label="ES" value={r.ES} changed={diff.regs.has('ES')} note="extra" />
              </>
            )}
          </>
        )}
      </div>

      <div className="px-2 pb-2">
        <div style={{ ...mono, fontSize: 'var(--fs-xs)', color: T.dim, marginBottom: 6 }}>Flags</div>
        <div className="flex flex-wrap gap-1.5">
          {(arch === '8085' ? FLAGS85 : FLAGS86).map(([k, m]) => (
            <Flag key={k} name={k} value={f[k]} changed={diff.flags.has(k)} meaning={m} />
          ))}
        </div>
        <p style={{ ...mono, fontSize: 'var(--fs-xs)', color: T.dimmer, marginTop: 6, lineHeight: 1.5 }}>
          {on.length ? `Currently set: ${on.join(', ')}. Hover a flag to see what it means.` : 'No flags are set right now.'}
        </p>
      </div>

      {detailed && (
        <div className="px-2 pb-3">
          <div style={{ ...mono, fontSize: 'var(--fs-xs)', color: T.dim, marginBottom: 6 }}>
            {arch === '8086' ? 'Where the pointers actually land' : 'Pointers (flat 64 KB)'}
          </div>
          <div className="rounded-[3px] py-1" style={{ background: T.panel, border: `1px solid ${T.lineSoft}` }}>
            {arch === '8086' ? (
              <>
                <Row label="CS:IP" seg={r.CS} off={r.IP} arch={arch} />
                <Row label="DS:SI" seg={r.DS} off={r.SI} arch={arch} />
                <Row label="ES:DI" seg={r.ES} off={r.DI} arch={arch} />
                <Row label="SS:SP" seg={r.SS} off={r.SP} arch={arch} />
                <Row label="DS:BX" seg={r.DS} off={r.BX} arch={arch} />
              </>
            ) : (
              <>
                <Row label="PC" off={r.PC} arch={arch} />
                <Row label="SP" off={r.SP} arch={arch} />
                <Row label="HL" off={HL(r)} arch={arch} />
                <Row label="BC" off={BC(r)} arch={arch} />
                <Row label="DE" off={DE(r)} arch={arch} />
              </>
            )}
          </div>

          {arch === '8086' && (
            <div className="mt-2 p-2 rounded-[3px]" style={{ background: T.panel, border: `1px solid ${T.lineSoft}` }}>
              <div style={{ ...mono, fontSize: 'var(--fs-xs)', color: T.dim, marginBottom: 5 }}>
                Work out a physical address
              </div>
              <div className="flex items-center gap-1.5" style={{ ...mono, fontSize: 'var(--fs-sm)' }}>
                <input
                  value={seg} maxLength={4} aria-label="Segment"
                  onChange={(e) => setSeg(e.target.value.replace(/[^0-9a-fA-F]/g, ''))}
                  className="w-14 px-1 outline-none text-center rounded-[2px]"
                  style={{ ...mono, fontSize: 'var(--fs-sm)', background: T.deep, color: T.purple, border: `1px solid ${T.line}` }}
                />
                <span style={{ color: T.dimmer }}>:</span>
                <input
                  value={off} maxLength={4} aria-label="Offset"
                  onChange={(e) => setOff(e.target.value.replace(/[^0-9a-fA-F]/g, ''))}
                  className="w-14 px-1 outline-none text-center rounded-[2px]"
                  style={{ ...mono, fontSize: 'var(--fs-sm)', background: T.deep, color: T.blue, border: `1px solid ${T.line}` }}
                />
                <span className="ml-auto" style={{ color: T.green }}>{hex(phys(segV, offV), 5)}H</span>
              </div>
              <div style={{ ...mono, fontSize: 'var(--fs-xs)', color: T.dimmer, marginTop: 5 }}>
                ({hex(segV, 4)} × 10H) + {hex(offV, 4)} = {hex(phys(segV, offV), 5)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
