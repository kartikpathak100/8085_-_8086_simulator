import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, Flame, Pencil } from 'lucide-react';
import { T, mono } from './theme.js';
import { hex } from '../core/utils.js';
import { HEAT_R, HEAT_W, HEAT_X } from '../core/machine.js';
import { Btn, Segmented } from './primitives.jsx';

const parseHex = (s, fallback) => {
  const v = parseInt(String(s).replace(/[^0-9a-fA-F]/g, ''), 16);
  return Number.isNaN(v) ? fallback : v;
};

/** One editable byte. Click it, type two hex digits, press Enter. */
function Cell({ addr, value, style, onWrite, wide }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const commit = () => {
    const v = parseInt(draft, 16);
    if (!Number.isNaN(v)) onWrite(addr, v & 0xff);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        maxLength={2}
        aria-label={`Value at ${hex(addr, 4)}H`}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9a-fA-F]/g, '').toUpperCase())}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        className="text-center outline-none rounded-[2px]"
        style={{
          ...mono, fontSize: 'var(--fs-sm)', width: wide ? 44 : 22,
          background: T.accent, color: '#fff', border: 'none',
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => { setDraft(hex(value)); setEditing(true); }}
      title={`${hex(addr, 5)}H = ${value} — click to edit`}
      className="rounded-[2px] text-center"
      style={{
        ...mono, fontSize: 'var(--fs-sm)', width: wide ? 44 : 22,
        background: 'transparent', border: 'none', cursor: 'text',
        transition: 'background 200ms linear', ...style,
      }}
    >
      {hex(value)}
    </button>
  );
}

export default function MemoryView({
  mem, heat, arch, pc, sp, lastWrites, onWrite, memVer,
}) {
  const limit = arch === '8085' ? 0x10000 : 0x100000;
  const defStart = arch === '8085' ? 0x2000 : 0x0100;

  const [startTxt, setStartTxt] = useState(hex(defStart, 4));
  const [endTxt, setEndTxt] = useState(hex(defStart + 0xff, 4));
  const [view, setView] = useState('grid');
  const [usedOnly, setUsedOnly] = useState(false);
  const [heatOn, setHeatOn] = useState(false);

  const start = Math.min(parseHex(startTxt, defStart), limit - 1);
  const end = Math.max(start, Math.min(parseHex(endTxt, start + 0xff), limit - 1));
  const count = Math.min(end - start + 1, 1024);

  const jump = (addr) => {
    const base = Math.max(0, Math.min(limit - 0x100, (addr - 0x40) & ~0xf));
    setStartTxt(hex(base, 4));
    setEndTxt(hex(base + 0xff, 4));
  };
  const page = (dir) => {
    const size = end - start + 1;
    const base = Math.max(0, Math.min(limit - size, start + dir * size));
    setStartTxt(hex(base, 4));
    setEndTxt(hex(base + size - 1, 4));
  };

  const tint = (addr) => {
    const h = heat.get(addr) || 0;
    if (lastWrites.has(addr)) return { background: T.accent, color: '#fff' };
    if (heatOn && h) {
      if (h & HEAT_X) return { background: T.exec, color: T.white };
      if (h & HEAT_W) return { background: T.write, color: T.white };
      if (h & HEAT_R) return { background: T.read, color: T.white };
    }
    if (addr === pc) return { background: T.hl, color: '#fff' };
    if (addr === sp) return { background: T.okWash, color: T.amber };
    return { color: mem[addr] ? T.text : T.dimmer };
  };

  const rows = useMemo(() => {
    const list = [];
    for (let i = 0; i < count; i++) {
      const a = start + i;
      if (usedOnly && !mem[a] && !heat.get(a)) continue;
      list.push(a);
    }
    return list;
    // memVer changes whenever memory is touched, which is what forces the refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, count, usedOnly, memVer, mem, heat]);

  const gridRows = Math.ceil(count / 16);

  return (
    <div className="h-full flex flex-col">
      {/* --------------------------- controls --------------------------- */}
      <div className="flex items-center gap-2 px-2.5 py-2 flex-wrap shrink-0"
        style={{ borderBottom: `1px solid ${T.lineSoft}`, background: T.rail }}>
        <span style={{ ...mono, fontSize: 'var(--fs-xs)', color: T.dim }}>Range</span>
        <input
          value={startTxt} maxLength={5} aria-label="Range start"
          onChange={(e) => setStartTxt(e.target.value.replace(/[^0-9a-fA-F]/g, '').toUpperCase())}
          className="w-16 px-1.5 py-[3px] text-center outline-none rounded-[3px]"
          style={{ ...mono, fontSize: 'var(--fs-sm)', background: T.deep, color: T.white, border: `1px solid ${T.line}` }}
        />
        <span style={{ color: T.dimmer }}>–</span>
        <input
          value={endTxt} maxLength={5} aria-label="Range end"
          onChange={(e) => setEndTxt(e.target.value.replace(/[^0-9a-fA-F]/g, '').toUpperCase())}
          className="w-16 px-1.5 py-[3px] text-center outline-none rounded-[3px]"
          style={{ ...mono, fontSize: 'var(--fs-sm)', background: T.deep, color: T.white, border: `1px solid ${T.line}` }}
        />

        <Btn icon={ChevronUp} onClick={() => page(-1)} title="Previous block" />
        <Btn icon={ChevronDown} onClick={() => page(1)} title="Next block" />

        <div className="w-px h-5" style={{ background: T.line }} />

        <Btn label="Code" onClick={() => jump(pc)} title="Jump to where the processor is running" />
        <Btn label="Stack" onClick={() => jump(sp)} title="Jump to the top of the stack" />

        <div className="ml-auto flex items-center gap-2">
          <Segmented
            value={view} onChange={setView} title="How to lay the bytes out"
            options={[{ value: 'grid', label: 'Grid' }, { value: 'list', label: 'List' }]}
          />
          <Btn icon={Flame} label="Activity" active={heatOn} onClick={() => setHeatOn(!heatOn)}
            title="Tint each byte by how the program touched it" />
          <label className="flex items-center gap-1.5 cursor-pointer select-none"
            style={{ ...mono, fontSize: 'var(--fs-xs)', color: T.dim }}
            title="Hide locations that are still zero and never used">
            <input type="checkbox" checked={usedOnly} onChange={(e) => setUsedOnly(e.target.checked)}
              style={{ accentColor: 'var(--c-accent)' }} />
            Used only
          </label>
        </div>
      </div>

      {/* ---------------------------- content ---------------------------- */}
      <div className="flex-1 overflow-auto p-2.5 anim-rise" key={view}>
        {view === 'grid' ? (
          <table style={{ ...mono, fontSize: 'var(--fs-sm)', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: T.dimmer }}>
                <th className="text-left pr-3 font-normal">address</th>
                {Array.from({ length: 16 }, (_, i) => <th key={i} className="px-[2px] font-normal">{hex(i)}</th>)}
                <th className="pl-3 text-left font-normal">text</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: gridRows }, (_, r) => {
                const rowAddr = start + r * 16;
                return (
                  <tr key={r} style={{ height: 'var(--row)' }}>
                    <td className="pr-3" style={{ color: T.dim }}>{hex(rowAddr, 4)}</td>
                    {Array.from({ length: 16 }, (_, c) => {
                      const a = rowAddr + c;
                      return (
                        <td key={c} className="px-[2px] text-center">
                          {a < limit && <Cell addr={a} value={mem[a]} style={tint(a)} onWrite={onWrite} />}
                        </td>
                      );
                    })}
                    <td className="pl-3" style={{ color: T.dimmer, letterSpacing: '0.08em' }}>
                      {Array.from({ length: 16 }, (_, c) => {
                        const v = mem[rowAddr + c];
                        return v >= 32 && v < 127 ? String.fromCharCode(v) : '.';
                      }).join('')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-wrap gap-x-6 gap-y-[2px]" style={{ ...mono, fontSize: 'var(--fs-sm)' }}>
            {rows.length === 0 && (
              <p style={{ color: T.dimmer }}>Nothing in this range has been used yet.</p>
            )}
            {rows.map((a) => (
              <div key={a} className="flex items-center gap-3" style={{ height: 'var(--row)', minWidth: 132 }}>
                <span style={{ color: T.dim, width: 46 }}>{hex(a, 4)}</span>
                <Cell addr={a} value={mem[a]} style={tint(a)} onWrite={onWrite} wide />
                <span style={{ color: T.dimmer, width: 26, textAlign: 'right' }}>{mem[a]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 px-2.5 py-1 shrink-0"
        style={{ borderTop: `1px solid ${T.lineSoft}`, ...mono, fontSize: 'var(--fs-xs)', color: T.dimmer }}>
        <Pencil size={10} />
        <span>Click any value to change it.</span>
        {heatOn && <span className="ml-auto">green read · red written · blue executed</span>}
        {!heatOn && <span className="ml-auto">{count} bytes shown{end - start + 1 > count ? ' (range trimmed)' : ''}</span>}
      </div>
    </div>
  );
}
