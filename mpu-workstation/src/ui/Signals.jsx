import React, { useRef, useEffect, useState } from 'react';
import { T, MONO, mono, resolveColors } from './theme.js';
import { hex } from '../core/utils.js';

const SIGNALS = {
  '8085': [
    { id: 'CLK', label: 'CLK' },
    { id: 'ALE', label: 'ALE' },
    { id: 'IOM', label: 'IO/M̄' },
    { id: 'RD', label: 'R̄D̄' },
    { id: 'WR', label: 'W̄R̄' },
    { id: 'AD', label: 'AD0-7', bus: true },
    { id: 'A', label: 'A8-15', bus: true },
  ],
  '8086': [
    { id: 'CLK', label: 'CLK' },
    { id: 'ALE', label: 'ALE' },
    { id: 'MIO', label: 'M/ĪŌ' },
    { id: 'DTR', label: 'DT/R̄' },
    { id: 'DEN', label: 'D̄ĒN̄' },
    { id: 'BHE', label: 'B̄H̄Ē' },
    { id: 'AD', label: 'AD0-15', bus: true },
  ],
};

function level(sig, cyc, tIdx, tCount) {
  const isIO = cyc.type === 'IOR' || cyc.type === 'IOW';
  const isWrite = cyc.type === 'MW' || cyc.type === 'IOW';
  switch (sig) {
    case 'ALE': return tIdx === 0 ? 1 : 0;
    case 'IOM': return isIO ? 1 : 0;
    case 'MIO': return isIO ? 0 : 1;
    case 'RD': return !isWrite && tIdx >= 1 && tIdx < tCount ? 0 : 1;
    case 'WR': return isWrite && tIdx >= 1 && tIdx < tCount ? 0 : 1;
    case 'DTR': return isWrite ? 1 : 0;
    case 'DEN': return tIdx >= 1 ? 0 : 1;
    case 'BHE': return cyc.addr % 2 === 1 ? 0 : 1;
    default: return 0;
  }
}

export default function Signals({ cycles, arch, freq, theme }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [w, setW] = useState(820);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(240, el.clientWidth - 20)));
    ro.observe(el);
    setW(Math.max(240, el.clientWidth - 20));
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const sigs = SIGNALS[arch];
    const ROW = 27, LABEL = 68, TOP = 24, TW = 17;
    const dpr = window.devicePixelRatio || 1;
    const height = TOP + sigs.length * ROW + 10;

    cv.width = w * dpr;
    cv.height = height * dpr;
    cv.style.width = `${w}px`;
    cv.style.height = `${height}px`;

    const C = resolveColors(cv, ['blue', 'green', 'red', 'amber', 'purple', 'dim', 'dimmer', 'grid', 'grid-strong', 'accent-text']);
    const COLOURS = { OF: C.blue, MR: C.green, MW: C.red, IOR: C.amber, IOW: C.purple };

    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, height);
    g.font = `10px ${MONO}`;

    const plotW = Math.max(60, w - LABEL - 6);
    const maxT = Math.floor(plotW / TW);

    const shown = [];
    let acc = 0;
    for (let i = cycles.length - 1; i >= 0; i--) {
      const t = Math.max(3, cycles[i].t);
      if (acc + t > maxT) break;
      acc += t;
      shown.unshift(cycles[i]);
    }

    sigs.forEach((s, i) => {
      const y = TOP + i * ROW;
      g.fillStyle = C.dim;
      g.fillText(s.label, 6, y + 14);
      g.strokeStyle = C.grid;
      g.beginPath(); g.moveTo(LABEL, y + 21.5); g.lineTo(LABEL + plotW, y + 21.5); g.stroke();
    });

    if (!shown.length) {
      g.fillStyle = C.dimmer;
      g.fillText('Step or run the program and the bus activity is drawn here.', LABEL + 6, TOP + 14);
      return;
    }

    let x = LABEL;
    shown.forEach((c) => {
      const tc = Math.max(3, c.t);
      const cw = tc * TW;
      g.fillStyle = COLOURS[c.type] || C.dim;
      g.globalAlpha = 0.12;
      g.fillRect(x, TOP - 15, cw - 2, 12);
      g.globalAlpha = 1;
      g.fillText(`${c.type} ${hex(c.addr, arch === '8085' ? 4 : 5)}`, x + 3, TOP - 5);
      g.strokeStyle = C['grid-strong'];
      for (let k = 0; k < tc; k++) {
        g.beginPath();
        g.moveTo(x + k * TW + 0.5, TOP - 17);
        g.lineTo(x + k * TW + 0.5, TOP + sigs.length * ROW - 6);
        g.stroke();
      }
      x += cw;
    });

    x = LABEL;
    shown.forEach((c) => {
      const tc = Math.max(3, c.t);
      sigs.forEach((s, i) => {
        const yTop = TOP + i * ROW + 2, yBot = TOP + i * ROW + 19;
        g.lineWidth = 1.4;

        if (s.id === 'CLK') {
          g.strokeStyle = C.dimmer;
          g.beginPath();
          for (let k = 0; k < tc; k++) {
            const x0 = x + k * TW;
            g.moveTo(x0, yBot); g.lineTo(x0, yTop);
            g.lineTo(x0 + TW / 2, yTop); g.lineTo(x0 + TW / 2, yBot);
            g.lineTo(x0 + TW, yBot);
          }
          g.stroke();
          return;
        }

        if (s.bus) {
          const hi = s.id === 'A';
          g.strokeStyle = COLOURS[c.type] || C.dim;
          g.fillStyle = COLOURS[c.type] || C.dim;
          const segs = hi
            ? [{ span: tc, txt: hex((c.addr >> 8) & 0xff, 2) }]
            : [{ span: 1, txt: hex(c.addr & 0xff, 2) }, { span: tc - 1, txt: hex(c.data, 2) }];
          let sx = x;
          segs.forEach((sg) => {
            const sw = sg.span * TW;
            g.beginPath();
            g.moveTo(sx + 3, (yTop + yBot) / 2);
            g.lineTo(sx + 6, yTop); g.lineTo(sx + sw - 6, yTop);
            g.lineTo(sx + sw - 3, (yTop + yBot) / 2);
            g.lineTo(sx + sw - 6, yBot); g.lineTo(sx + 6, yBot);
            g.closePath(); g.stroke();
            g.fillText(sg.txt, sx + sw / 2 - 6, (yTop + yBot) / 2 + 3.5);
            sx += sw;
          });
          return;
        }

        g.strokeStyle = s.id === 'ALE' ? C.amber : C['accent-text'];
        g.beginPath();
        let prev = null;
        for (let k = 0; k < tc; k++) {
          const lv = level(s.id, c, k, tc);
          const y = lv ? yTop : yBot;
          const x0 = x + k * TW;
          if (prev === null) g.moveTo(x0, y);
          else if (prev !== lv) { g.lineTo(x0, prev ? yTop : yBot); g.lineTo(x0, y); }
          g.lineTo(x0 + TW, y);
          prev = lv;
        }
        g.stroke();
      });
      x += tc * TW;
    });
  }, [cycles, arch, w, theme]);

  const totalT = cycles.reduce((a, c) => a + Math.max(3, c.t), 0);

  return (
    <div ref={wrapRef} className="h-full overflow-auto p-2.5">
      <canvas ref={canvasRef} />
      <div className="mt-2.5 flex flex-wrap gap-3.5"
        style={{ ...mono, fontSize: 'var(--fs-xs)', color: T.dimmer }}>
        <span style={{ color: T.blue }}>■ fetching an instruction</span>
        <span style={{ color: T.green }}>■ reading memory</span>
        <span style={{ color: T.red }}>■ writing memory</span>
        <span style={{ color: T.amber }}>■ reading a port</span>
        <span style={{ color: T.purple }}>■ writing a port</span>
        <span className="ml-auto">{cycles.length} cycles held · {totalT} T-states · {(freq / 1e6).toFixed(0)} MHz clock</span>
      </div>
    </div>
  );
}
