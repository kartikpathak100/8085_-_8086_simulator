import React from 'react';
import { Lightbulb, ToggleLeft, ArrowLeftRight, MonitorSmartphone } from 'lucide-react';
import { T, mono } from './theme.js';
import { hex, bin } from '../core/utils.js';

const SEGMENTS = {
  0: 0b0111111, 1: 0b0000110, 2: 0b1011011, 3: 0b1001111, 4: 0b1100110,
  5: 0b1101101, 6: 0b1111101, 7: 0b0000111, 8: 0b1111111, 9: 0b1101111,
  10: 0b1110111, 11: 0b1111100, 12: 0b0111001, 13: 0b1011110, 14: 0b1111001, 15: 0b1110001,
};

function Card({ icon: Icon, title, subtitle, children, footer }) {
  return (
    <section
      className="rounded-md anim-rise"
      style={{ background: T.panel, border: `1px solid ${T.line}`, boxShadow: T.shadowCard, minWidth: 210 }}
    >
      <header className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: `1px solid ${T.lineSoft}` }}>
        <Icon size={13} style={{ color: T.accentText }} />
        <h3 style={{ ...mono, fontSize: 'var(--fs)', color: T.text, margin: 0 }}>{title}</h3>
      </header>
      {subtitle && (
        <p style={{ ...mono, fontSize: 'var(--fs-xs)', color: T.dim, margin: 0, padding: '8px 12px 0', lineHeight: 1.5 }}>
          {subtitle}
        </p>
      )}
      <div className="px-3 py-3">{children}</div>
      {footer && (
        <footer className="px-3 py-2" style={{ borderTop: `1px solid ${T.lineSoft}`, ...mono, fontSize: 'var(--fs-xs)', color: T.dimmer }}>
          {footer}
        </footer>
      )}
    </section>
  );
}

function Digit({ nibble }) {
  const mask = SEGMENTS[nibble & 0xf];
  const lit = (i) => (mask >> i) & 1;
  const bar = (x, y, w, h, i) => (
    <rect
      key={i} x={x} y={y} width={w} height={h} rx={1.5}
      style={{
        fill: lit(i) ? T.segOn : T.segOff,
        filter: lit(i) ? 'drop-shadow(0 0 4px var(--c-seg-on))' : 'none',
        transition: 'fill 140ms linear, filter 140ms linear',
      }}
    />
  );
  return (
    <svg width="54" height="86" viewBox="0 0 46 74" role="img" aria-label={`Digit ${hex(nibble & 0xf, 1)}`}
      style={{ background: T.displayBg, border: `1px solid ${T.line}`, borderRadius: 4 }}>
      {bar(10, 6, 26, 5, 0)}
      {bar(34, 9, 5, 24, 1)}
      {bar(34, 37, 5, 24, 2)}
      {bar(10, 59, 26, 5, 3)}
      {bar(7, 37, 5, 24, 4)}
      {bar(7, 9, 5, 24, 5)}
      {bar(10, 33, 26, 5, 6)}
    </svg>
  );
}

export default function Devices({ ports, dip, setDip, io, arch }) {
  const display = ports.out[0x01];
  const leds = ports.out[0x02];

  return (
    <div className="h-full overflow-auto p-3.5 flex flex-wrap gap-4 items-start">
      <Card
        icon={MonitorSmartphone}
        title="Seven-segment display"
        subtitle="Wired to output port 01H — send it a byte and both digits update."
        footer={<>showing <span style={{ color: T.white }}>{hex(display)}H</span> · {bin(display)}</>}
      >
        <div className="flex gap-2.5 p-3 rounded" style={{ background: T.rail, border: `1px solid ${T.lineSoft}` }}>
          <Digit nibble={display >> 4} />
          <Digit nibble={display & 0xf} />
        </div>
      </Card>

      <Card
        icon={Lightbulb}
        title="LED bar"
        subtitle="Wired to output port 02H — one lamp per bit, bit 7 on the left."
        footer={<>holding <span style={{ color: T.white }}>{hex(leds)}H</span> · {bin(leds)}</>}
      >
        <div className="flex gap-2 p-3 rounded" style={{ background: T.rail, border: `1px solid ${T.lineSoft}` }}>
          {[7, 6, 5, 4, 3, 2, 1, 0].map((b) => {
            const on = (leds >> b) & 1;
            return (
              <div key={b} className="flex flex-col items-center gap-1.5">
                <span
                  aria-label={`LED ${b} ${on ? 'on' : 'off'}`}
                  style={{
                    width: 18, height: 18, borderRadius: 9,
                    background: on ? T.ledOn : T.ledOff,
                    border: `1px solid ${T.line}`,
                    boxShadow: on ? '0 0 10px var(--c-led-on)' : 'none',
                    transition: 'background 140ms linear, box-shadow 180ms linear',
                  }}
                />
                <span style={{ ...mono, fontSize: 'var(--fs-xs)', color: on ? T.green : T.dimmer }}>{b}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card
        icon={ToggleLeft}
        title="Switch bank"
        subtitle="Wired to input port 00H — flip a switch, then read the port from your program."
        footer={
          <>
            reads as <span style={{ color: T.white }}>{hex(dip)}H</span> when you run{' '}
            <span style={{ color: T.blue }}>{arch === '8085' ? 'IN 00H' : 'IN AL, 00H'}</span>
          </>
        }
      >
        <div className="flex gap-1.5 p-3 rounded" style={{ background: T.rail, border: `1px solid ${T.lineSoft}` }}>
          {[7, 6, 5, 4, 3, 2, 1, 0].map((b) => {
            const on = (dip >> b) & 1;
            return (
              <button
                key={b}
                type="button"
                onClick={() => setDip(dip ^ (1 << b))}
                aria-pressed={!!on}
                aria-label={`Switch bit ${b}`}
                title={`Bit ${b} — currently ${on ? 'on' : 'off'}`}
                className="press flex flex-col items-center justify-between py-1.5 rounded"
                style={{ width: 30, height: 64, background: T.deep, border: `1px solid ${T.line}` }}
              >
                <span
                  style={{
                    width: 18, height: 24, borderRadius: 3,
                    background: on ? T.ledOn : T.dimmer,
                    transform: on ? 'translateY(0)' : 'translateY(14px)',
                    transition: 'transform 150ms cubic-bezier(.2,.9,.3,1), background 140ms linear',
                  }}
                />
                <span style={{ ...mono, fontSize: 'var(--fs-xs)', color: on ? T.green : T.dimmer }}>{b}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card
        icon={ArrowLeftRight}
        title="Port traffic"
        subtitle="Every IN and OUT your program performs, newest first."
      >
        <div className="rounded p-2.5" style={{ background: T.rail, border: `1px solid ${T.lineSoft}`, minWidth: 190 }}>
          {io.length === 0 && (
            <p style={{ ...mono, fontSize: 'var(--fs-sm)', color: T.dimmer, margin: 0 }}>
              Nothing yet — run an IN or OUT instruction.
            </p>
          )}
          {io.slice(-12).reverse().map((e, i) => (
            <div key={i} className="flex gap-2 py-[2px] anim-rise" style={{ ...mono, fontSize: 'var(--fs-sm)' }}>
              <span style={{ color: e.dir === 'IN' ? T.amber : T.purple, width: 28 }}>{e.dir}</span>
              <span style={{ color: T.dim }}>port {hex(e.port)}H</span>
              <span className="ml-auto" style={{ color: T.white }}>{hex(e.value)}H</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
