import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { assemble } from './core/assembler.js';
import { initialState, stepOnce, pcOf, phys } from './core/machine.js';
import { MEM_SIZE, hex } from './core/utils.js';
import { SAMPLES } from './core/samples.js';
import { changeList } from './core/explain.js';

const EMPTY_DIFF = { regs: new Set(), flags: new Set() };
const EMPTY_PROG = { instructions: [], addrMap: new Map(), image: [], errors: [], symbols: {}, entry: 0 };

export const FREQS = [2_000_000, 5_000_000, 8_000_000];
export const SPEEDS = [
  { value: 3, label: 'Slow' },
  { value: 25, label: 'Steady' },
  { value: 300, label: 'Fast' },
  { value: 5000, label: 'Very fast' },
  { value: 80000, label: 'Full tilt' },
];

const store = {
  get(key, fallback) {
    try {
      const v = window.localStorage.getItem('mpu.' + key);
      return v === null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value) {
    try { window.localStorage.setItem('mpu.' + key, JSON.stringify(value)); } catch { /* storage disabled */ }
  },
};
export { store };

export function useMachine() {
  const [arch, setArch] = useState(() => store.get('arch', '8085'));
  const [code, setCode] = useState(() => store.get('code.' + store.get('arch', '8085'), SAMPLES[store.get('arch', '8085')][0].code));
  const [sampleId, setSampleId] = useState(() => {
    const a = store.get('arch', '8085');
    return store.get('code.' + a, null) ? 'custom' : SAMPLES[a][0].id;
  });
  const [freq, setFreq] = useState(() => store.get('freq', 2_000_000));
  const [speed, setSpeed] = useState(() => store.get('speed', 25));

  const [prog, setProg] = useState(EMPTY_PROG);
  const [cpu, setCpu] = useState(() => initialState(store.get('arch', '8085')));
  const [diff, setDiff] = useState(EMPTY_DIFF);
  const [lastWrites, setLastWrites] = useState(() => new Set());
  const [changes, setChanges] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [logs, setLogs] = useState([]);
  const [io, setIo] = useState([]);
  const [running, setRunning] = useState(false);
  const [breakpoints, setBreakpoints] = useState(() => new Set());
  const [dip, setDip] = useState(() => store.get('dip', 0x2a));
  const [builtSrc, setBuiltSrc] = useState('');
  const [memVer, setMemVer] = useState(0);
  const [rewindDepth, setRewindDepth] = useState(0);

  const memRef = useRef(new Uint8Array(MEM_SIZE));
  const heatRef = useRef(new Map());
  const portsRef = useRef({ in: new Uint8Array(256), out: new Uint8Array(256) });
  const histRef = useRef([]);
  const stateRef = useRef(cpu);
  const progRef = useRef(prog);
  const bpRef = useRef(breakpoints);
  const accRef = useRef(0);
  const flashRef = useRef(null);

  useEffect(() => { stateRef.current = cpu; }, [cpu]);
  useEffect(() => { progRef.current = prog; }, [prog]);
  useEffect(() => { bpRef.current = breakpoints; }, [breakpoints]);
  useEffect(() => { portsRef.current.in[0] = dip & 0xff; store.set('dip', dip); }, [dip]);
  useEffect(() => { store.set('arch', arch); }, [arch]);
  useEffect(() => { store.set('freq', freq); }, [freq]);
  useEffect(() => { store.set('speed', speed); }, [speed]);
  useEffect(() => {
    const id = setTimeout(() => store.set('code.' + arch, code), 400);
    return () => clearTimeout(id);
  }, [code, arch]);

  const pushLogs = useCallback((items) => {
    const stamp = new Date().toLocaleTimeString('en-GB', { hour12: false }).slice(3);
    setLogs((prev) => [
      ...prev,
      ...items.map((t) => (typeof t === 'string' ? { text: t, kind: 'info', stamp } : { ...t, stamp })),
    ].slice(-300));
  }, []);

  const flash = useCallback((d, writes) => {
    setDiff(d);
    setLastWrites(writes || new Set());
    clearTimeout(flashRef.current);
    flashRef.current = setTimeout(() => { setDiff(EMPTY_DIFF); setLastWrites(new Set()); }, 1000);
  }, []);

  const build = useCallback((src, a) => {
    const p = assemble(src, a);
    memRef.current.fill(0);
    heatRef.current.clear();
    const mask = a === '8085' ? 0xffff : 0xfffff;
    p.image.forEach(([addr, v]) => { memRef.current[addr & mask] = v; });
    portsRef.current.out.fill(0);
    histRef.current = [];
    const st = initialState(a);
    st.regs[a === '8085' ? 'PC' : 'IP'] = p.entry;
    stateRef.current = st;
    progRef.current = p;
    setProg(p); setCpu(st); setBuiltSrc(src);
    setCycles([]); setIo([]); setChanges([]);
    setDiff(EMPTY_DIFF); setLastWrites(new Set());
    setRunning(false); setRewindDepth(0);
    setMemVer((v) => v + 1);
    pushLogs([
      {
        text: `${a}: assembled ${p.instructions.length} statements into ${p.image.length} bytes, starting at ${hex(p.entry, 4)}H`,
        kind: p.ok ? 'ok' : 'info',
      },
      ...p.errors.map((e) => ({ text: `line ${e.line + 1}: ${e.msg}`, kind: 'err' })),
    ]);
    return p;
  }, [pushLogs]);

  useEffect(() => { build(code, arch); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const switchArch = useCallback((a) => {
    if (a === arch) return;
    const saved = store.get('code.' + a, null);
    const src = saved || SAMPLES[a][0].code;
    setArch(a);
    setCode(src);
    setSampleId(saved ? 'custom' : SAMPLES[a][0].id);
    setBreakpoints(new Set());
    build(src, a);
  }, [arch, build]);

  const loadSample = useCallback((id) => {
    const s = SAMPLES[arch].find((x) => x.id === id);
    if (!s) return;
    setSampleId(id);
    setCode(s.code);
    setBreakpoints(new Set());
    build(s.code, arch);
  }, [arch, build]);

  const runBatch = useCallback((n, withDiff) => {
    const p = progRef.current;
    if (!p.instructions.length) return;
    let st = stateRef.current;
    const before = st;
    const newCycles = [], writes = new Set(), newLogs = [], newIo = [];
    let stop = null, lastDiff = EMPTY_DIFF, prev = st;

    for (let i = 0; i < n; i++) {
      if (st.halted) { stop = 'halted'; break; }
      prev = st;
      const res = stepOnce({
        arch, prog: p, state: st, mem: memRef.current,
        heat: heatRef.current, ports: portsRef.current,
      });
      histRef.current.push({ state: st, undo: res.undo, nCycles: res.cycles.length });
      if (histRef.current.length > 4000) histRef.current.shift();
      st = res.state;
      lastDiff = res.diff;
      for (const c of res.cycles) newCycles.push(c);
      for (const a of res.writes) writes.add(a);
      for (const l of res.logs) newLogs.push(l);
      for (const e of res.io) newIo.push(e);
      if (res.error) { stop = 'nocode'; break; }
      if (st.halted) { stop = 'halted'; break; }
      const idx = p.addrMap.get(pcOf(arch, st));
      if (idx !== undefined && bpRef.current.has(p.instructions[idx].line)) { stop = 'breakpoint'; break; }
    }

    stateRef.current = st;
    setCpu(st);
    setCycles((c) => [...c, ...newCycles].slice(-90));
    if (newIo.length) setIo((v) => [...v, ...newIo].slice(-60));
    if (newLogs.length) pushLogs(newLogs);
    setMemVer((v) => v + 1);
    setRewindDepth(histRef.current.length);
    setChanges(changeList(withDiff ? prev : before, st, hex));
    if (withDiff) flash(lastDiff, writes); else setLastWrites(new Set());

    if (stop) {
      setRunning(false);
      if (stop === 'breakpoint') pushLogs([{ text: `paused at your breakpoint (${hex(pcOf(arch, st), 4)}H)`, kind: 'info' }]);
      if (stop === 'nocode') pushLogs([{ text: `stopped: there is no instruction at ${hex(pcOf(arch, st), 4)}H`, kind: 'err' }]);
    }
  }, [arch, flash, pushLogs]);

  const step = useCallback(() => { setRunning(false); runBatch(1, true); }, [runBatch]);

  const stepBack = useCallback(() => {
    setRunning(false);
    const h = histRef.current.pop();
    if (!h) { pushLogs([{ text: 'nothing left to rewind', kind: 'info' }]); return; }
    const cur = stateRef.current;
    const touched = new Set();
    for (let i = h.undo.length - 1; i >= 0; i--) {
      const [a, v] = h.undo[i];
      if (a < 0) portsRef.current.out[-1 - a] = v;
      else { memRef.current[a] = v; touched.add(a); }
    }
    const d = { regs: new Set(), flags: new Set() };
    for (const k of Object.keys(h.state.regs)) if (h.state.regs[k] !== cur.regs[k]) d.regs.add(k);
    for (const k of Object.keys(h.state.flags)) if (h.state.flags[k] !== cur.flags[k]) d.flags.add(k);
    stateRef.current = h.state;
    setCpu(h.state);
    setCycles((c) => c.slice(0, Math.max(0, c.length - h.nCycles)));
    setMemVer((v) => v + 1);
    setRewindDepth(histRef.current.length);
    setChanges(changeList(cur, h.state, hex));
    flash(d, touched);
  }, [flash, pushLogs]);

  const reset = useCallback(() => { setRunning(false); build(code, arch); }, [build, code, arch]);

  /** Poke a byte straight into memory from the memory editor. */
  const writeMemory = useCallback((addr, value) => {
    const mask = arch === '8085' ? 0xffff : 0xfffff;
    memRef.current[addr & mask] = value & 0xff;
    setMemVer((v) => v + 1);
  }, [arch]);

  useEffect(() => {
    if (!running) return;
    accRef.current = 0;
    const id = setInterval(() => {
      accRef.current += (speed * 40) / 1000;
      const n = Math.floor(accRef.current);
      if (n <= 0) return;
      accRef.current -= n;
      runBatch(Math.min(n, 40000), false);
    }, 40);
    return () => clearInterval(id);
  }, [running, speed, runBatch]);

  const toggleBreakpoint = useCallback((line) => {
    setBreakpoints((prev) => {
      const n = new Set(prev);
      if (n.has(line)) n.delete(line); else n.add(line);
      return n;
    });
  }, []);

  const pc = pcOf(arch, cpu);
  const activeIdx = prog.addrMap.get(pc);
  const currentIns = activeIdx !== undefined ? prog.instructions[activeIdx] : null;
  const activeLine = currentIns ? currentIns.line : null;
  const errorLines = useMemo(() => new Set(prog.errors.map((e) => e.line)), [prog]);

  return {
    arch, switchArch,
    code, setCode, sampleId, loadSample,
    freq, setFreq, speed, setSpeed,
    prog, cpu, diff, lastWrites, changes, cycles, logs, io, memVer,
    running, setRunning, step, stepBack, reset, build, writeMemory,
    breakpoints, toggleBreakpoint,
    dip, setDip,
    mem: memRef.current, heat: heatRef.current, ports: portsRef.current,
    pc,
    pcAbs: arch === '8085' ? cpu.regs.PC : phys(cpu.regs.CS, cpu.regs.IP),
    spAbs: arch === '8085' ? cpu.regs.SP : phys(cpu.regs.SS, cpu.regs.SP),
    currentIns, activeLine, errorLines,
    dirty: code !== builtSrc,
    rewindDepth,
  };
}
