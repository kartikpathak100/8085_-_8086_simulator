/* Bus model, execution engines and the reversible single-step driver. */

import { u8, u16, s8, hex, parityOf } from './utils.js';
import { R85NAME } from './isa8085.js';
import { R8PARENT } from './isa8086.js';
import { DEFAULT_ORG } from './assembler.js';

/* ======================= 2. BUS / MEMORY / CYCLES ========================= */

export const HEAT_R = 1, HEAT_W = 2, HEAT_X = 4;

export function makeBus(mem, arch, ctx) {
  const mask = arch === "8085" ? 0xffff : 0xfffff;
  const touch = (addr, bit) => {
    const prev = ctx.heat.get(addr) || 0;
    ctx.heat.set(addr, prev | bit);
  };
  return {
    fetch(addr) {
      const a = addr & mask;
      const v = mem[a];
      touch(a, HEAT_X);
      ctx.cycles.push({ type: "OF", addr: a, data: v, t: 4 });
      return v;
    },
    read(addr) {
      const a = addr & mask;
      const v = mem[a];
      touch(a, HEAT_R);
      ctx.cycles.push({ type: "MR", addr: a, data: v, t: 3 });
      return v;
    },
    write(addr, val) {
      const a = addr & mask;
      ctx.undo.push([a, mem[a]]);
      mem[a] = val & 0xff;
      touch(a, HEAT_W);
      ctx.cycles.push({ type: "MW", addr: a, data: val & 0xff, t: 3 });
      ctx.writes.add(a);
    },
    readW(addr) { return this.read(addr) | (this.read(addr + 1) << 8); },
    writeW(addr, v) { this.write(addr, v & 0xff); this.write(addr + 1, (v >> 8) & 0xff); },
    inPort(p) {
      const v = ctx.ports.in[p & 0xff] & 0xff;
      ctx.cycles.push({ type: "IOR", addr: p & 0xff, data: v, t: 3 });
      ctx.io.push({ dir: "IN", port: p & 0xff, value: v });
      return v;
    },
    outPort(p, v) {
      const port = p & 0xff;
      ctx.undo.push([-1 - port, ctx.ports.out[port]]);
      ctx.ports.out[port] = v & 0xff;
      ctx.cycles.push({ type: "IOW", addr: port, data: v & 0xff, t: 3 });
      ctx.io.push({ dir: "OUT", port, value: v & 0xff });
    },
    log(msg) { ctx.logs.push(msg); },
  };
}

/* ========================== 3a. 8085 EXECUTION ============================ */

export const HL = (r) => u16((r.H << 8) | r.L);
export const BC = (r) => u16((r.B << 8) | r.C);
export const DE = (r) => u16((r.D << 8) | r.E);
export const setHL = (r, v) => { r.H = (v >> 8) & 0xff; r.L = v & 0xff; };

function rd85(code, st, bus) {
  if (code === 6) return bus.read(HL(st.regs));
  return st.regs[R85NAME[code]] & 0xff;
}
function wr85(code, val, st, bus) {
  if (code === 6) bus.write(HL(st.regs), val);
  else st.regs[R85NAME[code]] = val & 0xff;
}
function szp85(f, v) {
  f.Z = (v & 0xff) === 0 ? 1 : 0;
  f.S = (v & 0x80) ? 1 : 0;
  f.P = parityOf(v);
}
function alu85run(op, acc, val, f) {
  let res;
  if (op === "ADD" || op === "ADC") {
    const cin = op === "ADC" ? f.CY : 0;
    res = acc + val + cin;
    f.CY = res > 0xff ? 1 : 0;
    f.AC = ((acc & 0xf) + (val & 0xf) + cin) > 0xf ? 1 : 0;
    res = u8(res);
    szp85(f, res);
    return res;
  }
  if (op === "SUB" || op === "SBB" || op === "CMP") {
    const bin_ = op === "SBB" ? f.CY : 0;
    const full = acc - val - bin_;
    f.CY = full < 0 ? 1 : 0;
    f.AC = ((acc & 0xf) - (val & 0xf) - bin_) < 0 ? 0 : 1;
    res = u8(full);
    szp85(f, res);
    return op === "CMP" ? acc : res;
  }
  if (op === "ANA") { res = acc & val; f.CY = 0; f.AC = 1; szp85(f, res); return res; }
  if (op === "XRA") { res = acc ^ val; f.CY = 0; f.AC = 0; szp85(f, res); return res; }
  if (op === "ORA") { res = acc | val; f.CY = 0; f.AC = 0; szp85(f, res); return res; }
  return acc;
}
const COND85 = {
  JNZ: (f) => !f.Z, JZ: (f) => !!f.Z, JNC: (f) => !f.CY, JC: (f) => !!f.CY,
  JPO: (f) => !f.P, JPE: (f) => !!f.P, JP: (f) => !f.S, JM: (f) => !!f.S,
  CNZ: (f) => !f.Z, CZ: (f) => !!f.Z, CNC: (f) => !f.CY, CC: (f) => !!f.CY,
  RNZ: (f) => !f.Z, RZ: (f) => !!f.Z, RNC: (f) => !f.CY, RC: (f) => !!f.CY,
};

function push85(st, bus, v) {
  st.regs.SP = u16(st.regs.SP - 1);
  bus.write(st.regs.SP, (v >> 8) & 0xff);
  st.regs.SP = u16(st.regs.SP - 1);
  bus.write(st.regs.SP, v & 0xff);
}
function pop85(st, bus) {
  const lo = bus.read(st.regs.SP);
  st.regs.SP = u16(st.regs.SP + 1);
  const hi = bus.read(st.regs.SP);
  st.regs.SP = u16(st.regs.SP + 1);
  return u16((hi << 8) | lo);
}
export const psw85 = (f) => (f.S << 7) | (f.Z << 6) | (f.AC << 4) | (f.P << 2) | 0x02 | f.CY;
const unpsw85 = (v, f) => {
  f.S = (v >> 7) & 1; f.Z = (v >> 6) & 1; f.AC = (v >> 4) & 1;
  f.P = (v >> 2) & 1; f.CY = v & 1;
};

export function exec85(ins, st, bus) {
  const r = st.regs, f = st.flags, ir = ins.ir;
  let t = ins.t;
  let branched = false;
  const RPREG = [["B", "C"], ["D", "E"], ["H", "L"], null];
  const getRP = (rp) => (rp === 3 ? r.SP : u16((r[RPREG[rp][0]] << 8) | r[RPREG[rp][1]]));
  const setRP = (rp, v) => {
    if (rp === 3) r.SP = u16(v);
    else { r[RPREG[rp][0]] = (v >> 8) & 0xff; r[RPREG[rp][1]] = v & 0xff; }
  };

  switch (ir.op) {
    case "NOP": break;
    case "HLT": st.halted = true; bus.log("HLT — processor halted"); break;
    case "MOV": wr85(ir.d, rd85(ir.s, st, bus), st, bus); break;
    case "MVI": wr85(ir.d, ir.v, st, bus); break;
    case "LXI": setRP(ir.rp, ir.v); break;
    case "LDA": r.A = bus.read(ir.a); break;
    case "STA": bus.write(ir.a, r.A); break;
    case "LHLD": setHL(r, bus.readW(ir.a)); break;
    case "SHLD": bus.writeW(ir.a, HL(r)); break;
    case "LDAX": r.A = bus.read(ir.rp === 0 ? BC(r) : DE(r)); break;
    case "STAX": bus.write(ir.rp === 0 ? BC(r) : DE(r), r.A); break;
    case "INR": {
      const v = rd85(ir.d, st, bus), res = u8(v + 1);
      f.AC = (v & 0xf) === 0xf ? 1 : 0; szp85(f, res); wr85(ir.d, res, st, bus); break;
    }
    case "DCR": {
      const v = rd85(ir.d, st, bus), res = u8(v - 1);
      f.AC = (v & 0xf) === 0 ? 0 : 1; szp85(f, res); wr85(ir.d, res, st, bus); break;
    }
    case "INX": setRP(ir.rp, u16(getRP(ir.rp) + 1)); break;
    case "DCX": setRP(ir.rp, u16(getRP(ir.rp) - 1)); break;
    case "DAD": {
      const sum = HL(r) + getRP(ir.rp);
      f.CY = sum > 0xffff ? 1 : 0; setHL(r, u16(sum)); break;
    }
    case "ADD": case "ADC": case "SUB": case "SBB": case "ANA": case "XRA": case "ORA": case "CMP":
      r.A = alu85run(ir.op, r.A, rd85(ir.s, st, bus), f); break;
    case "ADI": r.A = alu85run("ADD", r.A, ir.v, f); break;
    case "ACI": r.A = alu85run("ADC", r.A, ir.v, f); break;
    case "SUI": r.A = alu85run("SUB", r.A, ir.v, f); break;
    case "SBI": r.A = alu85run("SBB", r.A, ir.v, f); break;
    case "ANI": r.A = alu85run("ANA", r.A, ir.v, f); break;
    case "XRI": r.A = alu85run("XRA", r.A, ir.v, f); break;
    case "ORI": r.A = alu85run("ORA", r.A, ir.v, f); break;
    case "CPI": alu85run("CMP", r.A, ir.v, f); break;
    case "CMA": r.A = u8(~r.A); break;
    case "STC": f.CY = 1; break;
    case "CMC": f.CY = f.CY ? 0 : 1; break;
    case "RLC": { const c = (r.A >> 7) & 1; r.A = u8((r.A << 1) | c); f.CY = c; break; }
    case "RRC": { const c = r.A & 1; r.A = u8((r.A >> 1) | (c << 7)); f.CY = c; break; }
    case "RAL": { const c = (r.A >> 7) & 1; r.A = u8((r.A << 1) | f.CY); f.CY = c; break; }
    case "RAR": { const c = r.A & 1; r.A = u8((r.A >> 1) | (f.CY << 7)); f.CY = c; break; }
    case "DAA": {
      let a = r.A, carry = f.CY;
      if ((a & 0xf) > 9 || f.AC) { f.AC = ((a & 0xf) + 6) > 0xf ? 1 : 0; a += 6; }
      if (((a >> 4) & 0xf) > 9 || carry) { a += 0x60; carry = 1; }
      r.A = u8(a); f.CY = carry; szp85(f, r.A); break;
    }
    case "XCHG": {
      const h = r.H, l = r.L; r.H = r.D; r.L = r.E; r.D = h; r.E = l; break;
    }
    case "SPHL": r.SP = HL(r); break;
    case "PCHL": r.PC = HL(r); branched = true; break;
    case "XTHL": {
      const v = bus.readW(r.SP); bus.writeW(r.SP, HL(r)); setHL(r, v); break;
    }
    case "PUSH": {
      if (ir.rp === 3) push85(st, bus, u16((r.A << 8) | psw85(f)));
      else push85(st, bus, getRP(ir.rp));
      break;
    }
    case "POP": {
      const v = pop85(st, bus);
      if (ir.rp === 3) { r.A = (v >> 8) & 0xff; unpsw85(v & 0xff, f); }
      else setRP(ir.rp, v);
      break;
    }
    case "IN": r.A = bus.inPort(ir.p); break;
    case "OUT": bus.outPort(ir.p, r.A); break;
    case "EI": st.inte = 1; break;
    case "DI": st.inte = 0; break;
    case "RST": push85(st, bus, u16(r.PC + ins.bytes.length)); r.PC = ir.n * 8; branched = true; break;
    case "JMP": r.PC = ir.a; branched = true; break;
    case "CALL": push85(st, bus, u16(r.PC + ins.bytes.length)); r.PC = ir.a; branched = true; break;
    case "RET": r.PC = pop85(st, bus); branched = true; break;
    default: {
      if (COND85[ir.op]) {
        const taken = COND85[ir.op](f);
        if (ir.op[0] === "J") {
          if (taken) { r.PC = ir.a; branched = true; t = ins.t; } else t = ins.tAlt;
        } else if (ir.op[0] === "C") {
          if (taken) { push85(st, bus, u16(r.PC + ins.bytes.length)); r.PC = ir.a; branched = true; t = ins.t; }
          else t = ins.tAlt;
        } else {
          if (taken) { r.PC = pop85(st, bus); branched = true; t = ins.t; } else t = ins.tAlt;
        }
      } else {
        bus.log(`unimplemented opcode ${ir.op}`);
      }
    }
  }
  if (!branched && !st.halted) r.PC = u16(r.PC + ins.bytes.length);
  return t;
}

/* ========================== 3b. 8086 EXECUTION ============================ */

export const phys = (seg, off) => ((u16(seg) << 4) + u16(off)) & 0xfffff;

function ea86(op, st) {
  const r = st.regs;
  let a = op.disp || 0;
  if (op.base) a += r[op.base];
  if (op.index) a += r[op.index];
  return u16(a);
}
function opAddr86(op, st) {
  const off = ea86(op, st);
  return { off, phys: phys(st.regs[op.seg] || 0, off) };
}
function rdOp86(op, st, bus, w) {
  if (op.k === "i") return w === 1 ? u8(op.v) : u16(op.v);
  if (op.k === "r") return u16(st.regs[op.n]);
  if (op.k === "sr") return u16(st.regs[op.n]);
  if (op.k === "r8") {
    const [p, hi] = R8PARENT[op.n];
    return hi ? (st.regs[p] >> 8) & 0xff : st.regs[p] & 0xff;
  }
  const { phys: pa } = opAddr86(op, st);
  return w === 1 ? bus.read(pa) : bus.readW(pa);
}
function wrOp86(op, val, st, bus, w) {
  if (op.k === "r") { st.regs[op.n] = u16(val); return; }
  if (op.k === "sr") { st.regs[op.n] = u16(val); return; }
  if (op.k === "r8") {
    const [p, hi] = R8PARENT[op.n];
    st.regs[p] = hi
      ? u16((st.regs[p] & 0x00ff) | ((val & 0xff) << 8))
      : u16((st.regs[p] & 0xff00) | (val & 0xff));
    return;
  }
  const { phys: pa } = opAddr86(op, st);
  if (w === 1) bus.write(pa, val); else bus.writeW(pa, val);
}
function szp86(f, v, w) {
  const m = w === 1 ? 0xff : 0xffff;
  f.Z = (v & m) === 0 ? 1 : 0;
  f.S = (v & (w === 1 ? 0x80 : 0x8000)) ? 1 : 0;
  f.P = parityOf(v & 0xff);
}
function alu86run(op, a, b, f, w) {
  const m = w === 1 ? 0xff : 0xffff;
  const sign = w === 1 ? 0x80 : 0x8000;
  let res;
  switch (op) {
    case "ADD": case "ADC": {
      const cin = op === "ADC" ? f.C : 0;
      const full = a + b + cin;
      res = full & m;
      f.C = full > m ? 1 : 0;
      f.A = ((a & 0xf) + (b & 0xf) + cin) > 0xf ? 1 : 0;
      f.O = (~(a ^ b) & (a ^ res) & sign) ? 1 : 0;
      szp86(f, res, w); return res;
    }
    case "SUB": case "SBB": case "CMP": {
      const bin_ = op === "SBB" ? f.C : 0;
      const full = a - b - bin_;
      res = full & m;
      f.C = full < 0 ? 1 : 0;
      f.A = ((a & 0xf) - (b & 0xf) - bin_) < 0 ? 1 : 0;
      f.O = ((a ^ b) & (a ^ res) & sign) ? 1 : 0;
      szp86(f, res, w);
      return op === "CMP" ? a : res;
    }
    case "AND": res = a & b; f.C = 0; f.O = 0; szp86(f, res, w); return res;
    case "OR": res = a | b; f.C = 0; f.O = 0; szp86(f, res, w); return res;
    case "XOR": res = a ^ b; f.C = 0; f.O = 0; szp86(f, res, w); return res;
    default: return a;
  }
}
const COND86FN = {
  JE: (f) => !!f.Z, JZ: (f) => !!f.Z, JNE: (f) => !f.Z, JNZ: (f) => !f.Z,
  JC: (f) => !!f.C, JB: (f) => !!f.C, JNC: (f) => !f.C, JAE: (f) => !f.C,
  JS: (f) => !!f.S, JNS: (f) => !f.S, JO: (f) => !!f.O, JNO: (f) => !f.O,
  JA: (f) => !f.C && !f.Z, JBE: (f) => !!f.C || !!f.Z,
  JL: (f) => f.S !== f.O, JGE: (f) => f.S === f.O,
  JLE: (f) => !!f.Z || f.S !== f.O, JG: (f) => !f.Z && f.S === f.O,
};
const packFlags86 = (f) =>
  (f.O << 11) | (f.D << 10) | (f.I << 9) | (f.T << 8) | (f.S << 7) |
  (f.Z << 6) | (f.A << 4) | (f.P << 2) | f.C | 0xf002;
const unpackFlags86 = (v, f) => {
  f.O = (v >> 11) & 1; f.D = (v >> 10) & 1; f.I = (v >> 9) & 1; f.T = (v >> 8) & 1;
  f.S = (v >> 7) & 1; f.Z = (v >> 6) & 1; f.A = (v >> 4) & 1; f.P = (v >> 2) & 1; f.C = v & 1;
};
function push86(st, bus, v) {
  st.regs.SP = u16(st.regs.SP - 2);
  bus.writeW(phys(st.regs.SS, st.regs.SP), u16(v));
}
function pop86(st, bus) {
  const v = bus.readW(phys(st.regs.SS, st.regs.SP));
  st.regs.SP = u16(st.regs.SP + 2);
  return v;
}

export function exec86(ins, st, bus) {
  const r = st.regs, f = st.flags, ir = ins.ir;
  let t = ins.t, branched = false;
  const w = ir.w || 2;

  switch (ir.op) {
    case "NOP": break;
    case "HLT": st.halted = true; bus.log("HLT — processor halted"); break;
    case "CLC": f.C = 0; break;
    case "STC": f.C = 1; break;
    case "CLD": f.D = 0; break;
    case "STD": f.D = 1; break;
    case "CBW": r.AX = u16(s8(r.AX & 0xff)); break;
    case "MOV": wrOp86(ir.d, rdOp86(ir.s, st, bus, w), st, bus, w); break;
    case "XCHG": {
      const a = rdOp86(ir.d, st, bus, w), b = rdOp86(ir.s, st, bus, w);
      wrOp86(ir.d, b, st, bus, w); wrOp86(ir.s, a, st, bus, w); break;
    }
    case "ADD": case "SUB": case "AND": case "OR": case "XOR": case "ADC": case "SBB": {
      const res = alu86run(ir.op, rdOp86(ir.d, st, bus, w), rdOp86(ir.s, st, bus, w), f, w);
      wrOp86(ir.d, res, st, bus, w); break;
    }
    case "CMP": alu86run("CMP", rdOp86(ir.d, st, bus, w), rdOp86(ir.s, st, bus, w), f, w); break;
    case "INC": case "DEC": {
      const v = rdOp86(ir.d, st, bus, w);
      const carry = f.C;
      const res = alu86run(ir.op === "INC" ? "ADD" : "SUB", v, 1, f, w);
      f.C = carry; // INC/DEC leave CF untouched
      wrOp86(ir.d, res, st, bus, w); break;
    }
    case "NEG": {
      const v = rdOp86(ir.d, st, bus, w);
      wrOp86(ir.d, alu86run("SUB", 0, v, f, w), st, bus, w); break;
    }
    case "NOT": wrOp86(ir.d, ~rdOp86(ir.d, st, bus, w), st, bus, w); break;
    case "PUSH": push86(st, bus, rdOp86(ir.d, st, bus, 2)); break;
    case "POP": wrOp86(ir.d, pop86(st, bus), st, bus, 2); break;
    case "PUSHF": push86(st, bus, packFlags86(f)); break;
    case "POPF": unpackFlags86(pop86(st, bus), f); break;
    case "IN": {
      const p = ir.port.k === "i" ? ir.port.v : r.DX & 0xff;
      r.AX = u16((r.AX & 0xff00) | bus.inPort(p));
      break;
    }
    case "OUT": {
      const p = ir.port.k === "i" ? ir.port.v : r.DX & 0xff;
      bus.outPort(p, r.AX & 0xff); break;
    }
    case "JMP": r.IP = ir.a; branched = true; break;
    case "CALL": push86(st, bus, u16(r.IP + ins.bytes.length)); r.IP = ir.a; branched = true; break;
    case "RET": r.IP = pop86(st, bus); branched = true; break;
    case "IRET": {
      r.IP = pop86(st, bus); r.CS = pop86(st, bus); unpackFlags86(pop86(st, bus), f);
      branched = true; break;
    }
    case "LOOP": case "LOOPE": case "LOOPNE": {
      r.CX = u16(r.CX - 1);
      const extra = ir.op === "LOOPE" ? !!f.Z : ir.op === "LOOPNE" ? !f.Z : true;
      if (r.CX !== 0 && extra) { r.IP = ir.a; branched = true; t = ins.t; } else t = ins.tAlt;
      break;
    }
    case "JCXZ": {
      if (r.CX === 0) { r.IP = ir.a; branched = true; } else t = ins.tAlt;
      break;
    }
    case "INT": {
      const n = ir.n;
      push86(st, bus, packFlags86(f));
      push86(st, bus, r.CS);
      push86(st, bus, u16(r.IP + ins.bytes.length));
      f.I = 0; f.T = 0;
      const vecOff = bus.readW(n * 4), vecSeg = bus.readW(n * 4 + 2);
      if (vecOff === 0 && vecSeg === 0) {
        // No installed handler: the on-board monitor services the request.
        r.IP = pop86(st, bus); r.CS = pop86(st, bus); unpackFlags86(pop86(st, bus), f);
        if (n === 0x20) {
          st.halted = true;
          bus.log("INT 20H — program terminated, control returned to monitor");
        } else {
          bus.log(`INT ${hex(n)}H — no vector installed, serviced by monitor stub`);
        }
        branched = true;
        if (!st.halted) r.IP = u16(r.IP);
      } else {
        r.CS = vecSeg; r.IP = vecOff; branched = true;
        bus.log(`INT ${hex(n)}H — vectoring to ${hex(vecSeg, 4)}:${hex(vecOff, 4)}`);
      }
      break;
    }
    default: {
      if (COND86FN[ir.op]) {
        if (COND86FN[ir.op](f)) { r.IP = ir.a; branched = true; t = ins.t; }
        else t = ins.tAlt;
      } else bus.log(`unimplemented opcode ${ir.op}`);
    }
  }
  if (!branched) r.IP = u16(r.IP + ins.bytes.length);
  return t;
}

/* ===================== 3c. MACHINE STATE + STEPPING ======================= */

export function initialState(arch) {
  if (arch === "8085") {
    return {
      regs: { A: 0, B: 0, C: 0, D: 0, E: 0, H: 0, L: 0, PC: DEFAULT_ORG["8085"], SP: 0xffff },
      flags: { S: 0, Z: 0, AC: 0, P: 0, CY: 0 },
      halted: false, inte: 0, tStates: 0, instrs: 0,
    };
  }
  return {
    regs: {
      AX: 0, BX: 0, CX: 0, DX: 0, SI: 0, DI: 0, BP: 0, SP: 0xfffe,
      IP: DEFAULT_ORG["8086"], CS: 0x0000, DS: 0x0000, SS: 0x0000, ES: 0x0000,
    },
    flags: { O: 0, D: 0, I: 1, T: 0, S: 0, Z: 0, A: 0, P: 0, C: 0 },
    halted: false, tStates: 0, instrs: 0,
  };
}

export const cloneState = (s) => ({
  ...s, regs: { ...s.regs }, flags: { ...s.flags },
});

export const pcOf = (arch, st) => (arch === "8085" ? st.regs.PC : u16(st.regs.IP));

/**
 * Execute exactly one instruction.
 * Returns { state, undo, cycles, io, logs, diff, error, writes }
 */
export function stepOnce({ arch, prog, state, mem, heat, ports }) {
  const st = cloneState(state);
  const undo = [], cycles = [], logs = [], io = [], writes = new Set();
  const ctx = { undo, cycles, heat, ports, logs, io, writes };
  const bus = makeBus(mem, arch, ctx);

  const addr = pcOf(arch, st);
  const idx = prog.addrMap.get(addr);
  if (idx === undefined) {
    return {
      state: { ...st, halted: true }, undo, cycles, io, writes,
      logs: [`No instruction at ${hex(addr, 4)}H — execution stopped`],
      diff: { regs: new Set(), flags: new Set() }, error: true,
    };
  }
  const ins = prog.instructions[idx];
  const base = arch === "8085" ? addr : phys(st.regs.CS, addr);
  for (let i = 0; i < ins.bytes.length; i++) bus.fetch(base + i);

  const t = arch === "8085" ? exec85(ins, st, bus) : exec86(ins, st, bus);
  st.tStates += t || 4;
  st.instrs += 1;

  const diffRegs = new Set(), diffFlags = new Set();
  for (const k of Object.keys(st.regs)) if (st.regs[k] !== state.regs[k]) diffRegs.add(k);
  for (const k of Object.keys(st.flags)) if (st.flags[k] !== state.flags[k]) diffFlags.add(k);

  return { state: st, undo, cycles, io, logs, writes, ins, diff: { regs: diffRegs, flags: diffFlags }, error: false };
}

