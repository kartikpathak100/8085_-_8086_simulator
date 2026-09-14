import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play, Pause, StepForward, StepBack, RotateCcw, Cpu, Activity, Layers,
  Gauge, MemoryStick, Binary, MessageSquare, Zap, Code2, X, HelpCircle,
  Sun, Moon, PanelRight, FolderOpen, Save, MonitorDown, Keyboard, Circle,
} from 'lucide-react';

import { T, mono } from './ui/theme.js';
import { Btn, Select, Segmented, Panel, Splitter, Chip } from './ui/primitives.jsx';
import { Toasts, ShortcutsDialog, Dialog, Menu, MenuItem } from './ui/overlays.jsx';
import Dock from './ui/Dock.jsx';
import Editor from './ui/Editor.jsx';
import Registers from './ui/Registers.jsx';
import MemoryView from './ui/MemoryView.jsx';
import Devices from './ui/Devices.jsx';
import Signals from './ui/Signals.jsx';
import StackView from './ui/StackView.jsx';
import Disassembly from './ui/Disassembly.jsx';
import LogView from './ui/LogView.jsx';

import { useMachine, store, FREQS, SPEEDS } from './useMachine.js';
import { SAMPLES } from './core/samples.js';
import { describe } from './core/explain.js';
import { hex } from './core/utils.js';

const SIZES = [
  { value: '0.9', label: 'S' },
  { value: '1', label: 'M' },
  { value: '1.15', label: 'L' },
  { value: '1.3', label: 'XL' },
];

const PRIMARY = ['registers', 'memory', 'devices'];
const EXTRA = ['disasm', 'signals', 'stack', 'messages'];
const META = {
  registers: { title: 'Registers', icon: Cpu },
  memory: { title: 'Memory', icon: MemoryStick },
  devices: { title: 'Devices', icon: Gauge },
  disasm: { title: 'Machine code', icon: Binary },
  signals: { title: 'Signals', icon: Activity },
  stack: { title: 'Stack', icon: Layers },
  messages: { title: 'Messages', icon: MessageSquare },
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function formatTime(tStates, freq) {
  const s = tStates / freq;
  if (s < 1e-3) return `${(s * 1e6).toFixed(2)} µs`;
  if (s < 1) return `${(s * 1e3).toFixed(3)} ms`;
  return `${s.toFixed(4)} s`;
}

export default function App() {
  const m = useMachine();

  const [theme, setTheme] = useState(() => store.get('theme', 'dark'));
  const [k, setK] = useState(() => store.get('scale', 1));
  const [open, setOpen] = useState(() => store.get('panels', ['registers']));
  const [activeDock, setActiveDock] = useState(() => store.get('panels', ['registers'])[0] || 'registers');
  const [dockW, setDockW] = useState(() => store.get('dockW', 340));
  const [dockH, setDockH] = useState(() => store.get('dockH', 300));
  const [bottomH, setBottomH] = useState(() => store.get('bottomH', 104));
  const [narrow, setNarrow] = useState(false);
  const [showHint, setShowHint] = useState(() => !store.get('hintSeen', false));
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [installEvt, setInstallEvt] = useState(null);

  const fileRef = useRef(null);
  const fs = Math.round(12 * k);
  const lh = Math.round(18 * k);

  /* ------------------------------ persistence ---------------------------- */
  useEffect(() => { store.set('theme', theme); document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  useEffect(() => { store.set('scale', k); }, [k]);
  useEffect(() => { store.set('panels', open); }, [open]);
  useEffect(() => { store.set('dockW', dockW); }, [dockW]);
  useEffect(() => { store.set('dockH', dockH); }, [dockH]);
  useEffect(() => { store.set('bottomH', bottomH); }, [bottomH]);

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 950);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const grab = (e) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener('beforeinstallprompt', grab);
    return () => window.removeEventListener('beforeinstallprompt', grab);
  }, []);

  /* -------------------------------- toasts ------------------------------- */
  const toast = useCallback((text, kind = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((t) => [...t.slice(-3), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);
  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  /* -------------------------------- panels ------------------------------- */
  const closePanel = useCallback((id) => {
    const next = open.filter((p) => p !== id);
    setOpen(next);
    if (activeDock === id) setActiveDock(next[next.length - 1] || null);
  }, [open, activeDock]);

  const togglePanel = useCallback((id) => {
    if (open.includes(id)) { closePanel(id); return; }
    setOpen([...open, id]);
    setActiveDock(id);
  }, [open, closePanel]);

  /* --------------------------------- files ------------------------------- */
  const openFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => { m.setCode(String(reader.result)); toast(`Loaded ${f.name}`, 'ok'); };
    reader.onerror = () => toast(`Could not read ${f.name}`, 'err');
    reader.readAsText(f);
    e.target.value = '';
  };

  const saveFile = useCallback(() => {
    const blob = new Blob([m.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `program-${m.arch}.asm`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast(`Saved program-${m.arch}.asm`, 'ok');
  }, [m.code, m.arch, toast]);

  /* ------------------------------- assemble ------------------------------ */
  const assemble = useCallback(() => {
    const p = m.build(m.code, m.arch);
    if (p.errors.length) {
      toast(`${p.errors.length} problem${p.errors.length > 1 ? 's' : ''} — line ${p.errors[0].line + 1}: ${p.errors[0].msg}`, 'err');
      if (!open.includes('messages')) { setOpen([...open, 'messages']); setActiveDock('messages'); }
    } else {
      toast(`Loaded ${p.image.length} bytes, ready at ${hex(p.entry, 4)}H`, 'ok');
    }
  }, [m, toast, open]);

  const pokeMemory = useCallback((addr, value) => {
    m.writeMemory(addr, value);
    toast(`Wrote ${hex(value)}H into ${hex(addr, 4)}H`);
  }, [m, toast]);

  const install = useCallback(async () => {
    if (!installEvt) { setDialog('install'); return; }
    installEvt.prompt();
    const choice = await installEvt.userChoice;
    if (choice.outcome === 'accepted') toast('Added to your desktop', 'ok');
    setInstallEvt(null);
  }, [installEvt, toast]);

  /* ------------------------------ shortcuts ------------------------------ */
  const { step, stepBack, setRunning } = m;
  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || '');
      const cmd = e.ctrlKey || e.metaKey;
      if (e.key === 'F10') { e.preventDefault(); step(); }
      else if (e.key === 'F8') { e.preventDefault(); stepBack(); }
      else if (e.key === 'F5') { e.preventDefault(); setRunning((r) => !r); }
      else if (cmd && e.key === 'Enter') { e.preventDefault(); assemble(); }
      else if (cmd && e.key.toLowerCase() === 's') { e.preventDefault(); saveFile(); }
      else if (cmd && e.key.toLowerCase() === 'o') { e.preventDefault(); fileRef.current?.click(); }
      else if (e.key === '?' && !typing) { e.preventDefault(); setDialog('keys'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, stepBack, setRunning, assemble, saveFile]);

  /* ------------------------------- resizing ------------------------------ */
  const dragDock = useCallback((d) => {
    if (narrow) setDockH((h) => clamp(h - d, 140, 640));
    else setDockW((w) => clamp(w - d, 260, 720));
  }, [narrow]);
  const dragBottom = useCallback((dy) => setBottomH((h) => clamp(h - dy, 0, 340)), []);

  /* -------------------------------- panels ------------------------------- */
  const renderers = {
    registers: () => <Registers arch={m.arch} cpu={m.cpu} diff={m.diff} detailed />,
    memory: () => (
      <MemoryView
        mem={m.mem} heat={m.heat} arch={m.arch} pc={m.pcAbs} sp={m.spAbs}
        lastWrites={m.lastWrites} onWrite={pokeMemory} memVer={m.memVer}
      />
    ),
    devices: () => <Devices ports={m.ports} dip={m.dip} setDip={m.setDip} io={m.io} arch={m.arch} />,
    disasm: () => (
      <Disassembly prog={m.prog} pc={m.pc} breakpoints={m.breakpoints}
        onToggleBreakpoint={m.toggleBreakpoint} lh={lh} />
    ),
    signals: () => <Signals cycles={m.cycles} arch={m.arch} freq={m.freq} theme={theme} />,
    stack: () => <StackView arch={m.arch} cpu={m.cpu} mem={m.mem} lastWrites={m.lastWrites} />,
    messages: () => <LogView logs={m.logs} />,
  };

  const dockPanels = open
    .filter((id) => META[id])
    .map((id) => ({ id, title: META[id].title, icon: META[id].icon, render: renderers[id] }));

  /* ------------------------------- activity ------------------------------ */
  const activity = (
    <div className="h-full overflow-auto px-3.5 py-2.5" style={{ background: T.deep }}>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span style={{ ...mono, fontSize: 'var(--fs-xs)', color: T.dim }}>
          {m.cpu.halted ? 'Finished' : 'Next instruction'}
        </span>
        {m.currentIns && !m.cpu.halted && (
          <span style={{ ...mono, fontSize: 'var(--fs-sm)', color: T.blue }}>
            {hex(m.currentIns.addr, 4)}H · {m.currentIns.mnemonic} {m.currentIns.operands.join(', ')}
          </span>
        )}
      </div>
      <p key={m.pc + '-' + m.cpu.instrs} className="anim-rise"
        style={{ ...mono, fontSize: 'var(--fs)', color: T.text, margin: '5px 0 0', lineHeight: 1.55 }}>
        {m.cpu.halted
          ? 'The processor has stopped. Press Reset to load the program again, or step backwards to retrace what happened.'
          : describe(m.currentIns, m.arch)}
      </p>
      {m.changes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          <span style={{ ...mono, fontSize: 'var(--fs-xs)', color: T.dim, lineHeight: '22px' }}>
            That last step changed
          </span>
          {m.changes.slice(0, 10).map((c, i) => (
            <span key={c + i} className="px-2 rounded-[3px] anim-pop"
              style={{
                ...mono, fontSize: 'var(--fs-xs)', lineHeight: '22px',
                background: T.hlSoft, color: T.accentText, border: `1px solid ${T.line}`,
              }}>
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  const hasDock = dockPanels.length > 0;

  return (
    <div
      data-theme={theme}
      className="w-full h-full flex flex-col overflow-hidden"
      style={{
        background: T.base,
        color: T.text,
        '--fs-xs': `${Math.round(10 * k)}px`,
        '--fs-sm': `${Math.round(11 * k)}px`,
        '--fs': `${fs}px`,
        '--fs-lg': `${Math.round(13 * k)}px`,
        '--row': `${lh}px`,
      }}
    >
      {/* ------------------------------ toolbar ----------------------------- */}
      <header
        className="flex items-center gap-2 px-3 py-2 flex-wrap shrink-0"
        style={{ background: T.headerGrad, borderBottom: `1px solid ${T.line}`, boxShadow: T.shadowCard }}
      >
        <div className="flex items-center gap-2 mr-1">
          <Cpu size={16} style={{ color: T.accentText }} />
          <span style={{ ...mono, fontSize: 'var(--fs)', color: T.white }}>MPU Workstation</span>
        </div>

        <Segmented
          value={m.arch}
          onChange={m.switchArch}
          options={[{ value: '8085', label: '8085' }, { value: '8086', label: '8086' }]}
          title="Choose the processor"
        />

        <Select
          value={m.sampleId}
          onChange={m.loadSample}
          width={narrow ? 150 : 200}
          title="Load a ready-made program"
          options={[
            ...(m.sampleId === 'custom' ? [{ value: 'custom', label: 'Your program' }] : []),
            ...SAMPLES[m.arch].map((s) => ({ value: s.id, label: s.name })),
          ]}
        />

        <Btn icon={FolderOpen} onClick={() => fileRef.current?.click()} title="Open an .asm file (Ctrl+O)" />
        <Btn icon={Save} onClick={saveFile} title="Save your program (Ctrl+S)" />
        <input ref={fileRef} type="file" accept=".asm,.txt,.s,.src" onChange={openFile} className="hidden" />

        <Btn icon={Zap} label={m.dirty ? 'Assemble •' : 'Assemble'} onClick={assemble}
          title="Turn your code into machine code and load it (Ctrl+Enter)" />

        <div className="w-px h-6 mx-0.5" style={{ background: T.line }} />

        <Btn icon={m.running ? Pause : Play} label={m.running ? 'Pause' : 'Run'} active={m.running}
          onClick={() => m.setRunning(!m.running)} disabled={m.cpu.halted || !m.prog.instructions.length}
          title="Run or pause (F5)" />
        <Btn icon={StepForward} label="Step" onClick={m.step} disabled={m.cpu.halted} title="Run one instruction (F10)" />
        <Btn icon={StepBack} label="Back" onClick={m.stepBack} disabled={m.rewindDepth === 0}
          title="Undo the last instruction (F8)" />
        <Btn icon={RotateCcw} label="Reset" onClick={m.reset} title="Start the program over" />

        <Select value={String(m.speed)} onChange={(v) => m.setSpeed(Number(v))} title="How fast Run goes"
          options={SPEEDS.map((s) => ({ value: String(s.value), label: s.label }))} />

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {!narrow && (
            <>
              <Chip label="time" value={formatTime(m.cpu.tStates, m.freq)} color={T.amber}
                title="How long this would take on real hardware" />
              <Chip label="steps" value={m.cpu.instrs.toLocaleString()} title="Instructions executed so far" />
            </>
          )}

          <div className="flex items-center gap-1.5 px-1.5 rounded-[3px]"
            style={{ border: `1px solid ${T.line}`, background: T.deep }}>
            <PanelRight size={12} style={{ color: T.dimmer }} />
            {PRIMARY.map((id) => (
              <Btn key={id} icon={META[id].icon} label={narrow ? undefined : META[id].title}
                active={open.includes(id)} onClick={() => togglePanel(id)}
                title={`${open.includes(id) ? 'Hide' : 'Show'} ${META[id].title.toLowerCase()} on the right`} />
            ))}
          </div>

          <Menu label={narrow ? undefined : 'View'} icon={Layers}>
            {EXTRA.map((id) => (
              <MenuItem key={id} icon={META[id].icon} label={META[id].title}
                checked={open.includes(id)} onClick={() => togglePanel(id)} />
            ))}
            <div className="my-1.5" style={{ borderTop: `1px solid ${T.lineSoft}` }} />
            <MenuItem icon={MonitorDown} label="Add to desktop" onClick={install} />
            <MenuItem icon={Keyboard} label="Keyboard shortcuts" hint="?" onClick={() => setDialog('keys')} />
            <MenuItem icon={HelpCircle} label="Show the getting-started tip" onClick={() => setShowHint(true)} />
          </Menu>

          <Btn icon={theme === 'dark' ? Sun : Moon}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'} />

          <Segmented value={String(k)} onChange={(v) => setK(Number(v))} options={SIZES} title="Text size" />
        </div>
      </header>

      {/* -------------------------------- hint ------------------------------ */}
      {showHint && (
        <div className="flex items-center gap-3 px-3.5 py-2.5 shrink-0 anim-rise"
          style={{ background: T.hlFaint, borderBottom: `1px solid ${T.line}` }}>
          <HelpCircle size={14} style={{ color: T.accentText, flexShrink: 0 }} />
          <p style={{ ...mono, fontSize: 'var(--fs-sm)', color: T.text, margin: 0, lineHeight: 1.55 }}>
            Pick a program, press <b>Assemble</b>, then <b>Step</b> through it one instruction at a time. The strip
            below the editor explains each instruction, <b>Back</b> undoes a step, and the buttons on the right open
            the registers, memory and devices whenever you want them.
          </p>
          <button type="button" onClick={() => { setShowHint(false); store.set('hintSeen', true); }}
            className="ml-auto p-1 rounded-[3px] shrink-0" aria-label="Hide this tip" style={{ color: T.dim }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* -------------------------------- body ------------------------------ */}
      <main className={`flex-1 flex min-h-0 ${narrow ? 'flex-col' : ''}`}>
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="flex-1 min-h-0">
            <Panel
              title="Your program"
              icon={Code2}
              right={
                <span style={{
                  ...mono, fontSize: 'var(--fs-xs)',
                  color: m.prog.errors.length ? T.red : m.dirty ? T.amber : T.dimmer,
                }}>
                  {m.prog.errors.length
                    ? `${m.prog.errors.length} problem${m.prog.errors.length > 1 ? 's' : ''} to fix`
                    : m.dirty ? 'edited — press Assemble' : `${m.prog.image.length} bytes loaded`}
                </span>
              }
              flush
            >
              <Editor
                code={m.code} setCode={m.setCode} arch={m.arch}
                activeLine={m.activeLine} breakpoints={m.breakpoints}
                toggleBreakpoint={m.toggleBreakpoint} errorLines={m.errorLines}
                lh={lh} fs={fs}
              />
            </Panel>
          </div>

          {bottomH > 0 && (
            <>
              <Splitter axis="y" label="Resize the explanation strip" onDelta={dragBottom}
                onReset={() => setBottomH(104)} />
              <div className="shrink-0" style={{ height: bottomH, borderTop: `1px solid ${T.line}` }}>
                {activity}
              </div>
            </>
          )}
        </div>

        {hasDock && (
          <Splitter axis={narrow ? 'y' : 'x'} label="Resize the panel dock" onDelta={dragDock}
            onReset={() => (narrow ? setDockH(300) : setDockW(340))} />
        )}
        {hasDock && (
          <div className="shrink-0 min-w-0" style={narrow ? { height: dockH } : { width: dockW }}>
            <Dock panels={dockPanels} active={activeDock} setActive={setActiveDock} onClose={closePanel} />
          </div>
        )}
      </main>

      {/* ------------------------------- status ----------------------------- */}
      <footer className="flex items-center gap-4 px-3 shrink-0 overflow-x-auto"
        style={{ height: 24, background: T.accent, color: '#eaf3fb', ...mono, fontSize: 'var(--fs-xs)' }}>
        <span className="flex items-center gap-1.5">
          <Circle size={7} fill="currentColor" className={m.running ? 'pulse-dot' : ''} />
          {m.cpu.halted ? 'stopped' : m.running ? 'running' : 'ready'}
        </span>
        <span>
          {m.arch === '8085' ? 'PC' : 'CS:IP'}{' '}
          {m.arch === '8085' ? `${hex(m.pc, 4)}H` : `${hex(m.cpu.regs.CS, 4)}:${hex(m.cpu.regs.IP, 4)}`}
        </span>
        {m.breakpoints.size > 0 && <span>{m.breakpoints.size} breakpoint{m.breakpoints.size === 1 ? '' : 's'}</span>}
        <span>{m.rewindDepth} steps you can undo</span>
        <span className="ml-auto whitespace-nowrap">
          {m.logs.length ? m.logs[m.logs.length - 1].text : 'F5 run · F10 step · F8 back · ? for shortcuts'}
        </span>
      </footer>

      <Toasts items={toasts} dismiss={dismissToast} />
      {dialog === 'keys' && <ShortcutsDialog onClose={() => setDialog(null)} />}
      {dialog === 'install' && (
        <Dialog title="Add to your desktop" onClose={() => setDialog(null)}>
          <p style={{ ...mono, fontSize: 'var(--fs-sm)', color: T.text, lineHeight: 1.65, margin: 0 }}>
            This workstation installs as a desktop app. In Chrome or Edge, open the address bar menu and choose
            <b> Install</b>, or use the install icon at the right of the address bar. Safari on macOS offers
            <b> Add to Dock</b> in the Share menu.
          </p>
          <p style={{ ...mono, fontSize: 'var(--fs-sm)', color: T.dim, lineHeight: 1.65, marginTop: 10 }}>
            If you would rather have a plain shortcut that opens it in its own window, run
            <b> scripts/make-shortcut.sh</b> on macOS or Linux, or <b>scripts/make-shortcut.bat</b> on Windows.
          </p>
        </Dialog>
      )}
    </div>
  );
}
