/**
 * Engine self-check. Runs every built-in program headlessly and asserts the
 * results, then rewinds one of them to prove reverse execution is lossless.
 *
 *   npm test
 */
import { assemble } from '../src/core/assembler.js';
import { initialState, stepOnce, pcOf } from '../src/core/machine.js';
import { MEM_SIZE, hex } from '../src/core/utils.js';
import { SAMPLES } from '../src/core/samples.js';

let failures = 0;
const check = (name, got, want) => {
  const ok = String(got) === String(want);
  if (!ok) failures++;
  console.log(`  ${ok ? 'pass' : 'FAIL'}  ${name}${ok ? '' : `\n        expected ${want}\n        received ${got}`}`);
};

function run(arch, code, { dip = 0x2a, limit = 200000 } = {}) {
  const prog = assemble(code, arch);
  if (prog.errors.length) {
    failures++;
    prog.errors.forEach((e) => console.log(`  FAIL  assembler, line ${e.line + 1}: ${e.msg}`));
  }
  const mem = new Uint8Array(MEM_SIZE);
  const mask = arch === '8085' ? 0xffff : 0xfffff;
  prog.image.forEach(([a, v]) => { mem[a & mask] = v; });
  const ports = { in: new Uint8Array(256), out: new Uint8Array(256) };
  ports.in[0] = dip;
  const heat = new Map();
  const history = [];
  let st = initialState(arch);
  st.regs[arch === '8085' ? 'PC' : 'IP'] = prog.entry;
  let n = 0;
  while (!st.halted && n < limit) {
    const res = stepOnce({ arch, prog, state: st, mem, heat, ports });
    history.push({ state: st, undo: res.undo });
    if (res.error) break;
    st = res.state;
    n++;
  }
  return { prog, mem, ports, st, history, n };
}

const bytes = (mem, at, n) => Array.from(mem.slice(at, at + n)).map((v) => hex(v)).join(' ');
const text = (mem, at, n) => Array.from(mem.slice(at, at + n)).map((c) => String.fromCharCode(c)).join('');

console.log('\n8085');
check('bubble sort orders the array', bytes(run('8085', SAMPLES['8085'][0].code).mem, 0x3001, 6), '04 12 21 38 77 9A');
check('fibonacci writes ten terms', bytes(run('8085', SAMPLES['8085'][1].code).mem, 0x3050, 10), '00 01 01 02 03 05 08 0D 15 22');
check('counter echoes the switches', hex(run('8085', SAMPLES['8085'][2].code).ports.out[1]), '2A');

console.log('\n8086');
check('string is reversed', text(run('8086', SAMPLES['8086'][0].code).mem, 0x2010, 8), 'ORPORCIM');
check('block is transferred', bytes(run('8086', SAMPLES['8086'][1].code).mem, 0x4000, 8), '11 11 22 22 33 33 44 44');
{
  const r = run('8086', SAMPLES['8086'][2].code);
  check('interrupt handler ran', hex(r.st.regs.BX, 4), '1235');
  check('handler wrote DX', hex(r.st.regs.DX, 4), '00AA');
  check('display received the switches', hex(r.ports.out[1]), '2A');
}

console.log('\nreverse execution');
{
  const r = run('8085', SAMPLES['8085'][1].code);
  let st = r.st;
  for (let i = r.history.length - 1; i >= 0; i--) {
    const h = r.history[i];
    for (let k = h.undo.length - 1; k >= 0; k--) {
      const [a, v] = h.undo[k];
      if (a >= 0) r.mem[a] = v;
    }
    st = h.state;
  }
  check('registers return to the start', hex(pcOf('8085', st), 4), '2000');
  check('clock returns to zero', st.tStates, 0);
  check('memory writes are undone', bytes(r.mem, 0x3050, 4), '00 00 00 00');
}

console.log(failures ? `\n${failures} check(s) failed\n` : '\nall checks passed\n');
process.exit(failures ? 1 : 0);
