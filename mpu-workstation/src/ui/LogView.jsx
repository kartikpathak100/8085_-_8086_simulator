import React, { useRef, useEffect } from 'react';
import { T, mono } from './theme.js';
import { Empty } from './primitives.jsx';

export default function LogView({ logs }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [logs]);

  if (!logs.length) return <Empty>Assembler messages and anything the processor reports will show up here.</Empty>;

  return (
    <div ref={ref} className="h-full overflow-auto p-2.5" style={{ ...mono, fontSize: 'var(--fs-sm)' }}>
      {logs.map((l, i) => (
        <div key={i} className="flex gap-2 py-[1px]"
          style={{ color: l.kind === 'err' ? T.red : l.kind === 'ok' ? T.green : T.text }}>
          <span style={{ color: T.dimmer, width: 48 }}>{l.stamp}</span>
          <span className="whitespace-pre-wrap">{l.text}</span>
        </div>
      ))}
    </div>
  );
}
