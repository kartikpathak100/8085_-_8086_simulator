/* Intel 8086 instruction encodings and single-statement assembler. */

import { u8, u16, evalExpr } from './utils.js';

/* ======================== 1b. 8086 INSTRUCTION SET ======================== */

export const R16 = { AX: 0, CX: 1, DX: 2, BX: 3, SP: 4, BP: 5, SI: 6, DI: 7 };
export const R8 = { AL: 0, CL: 1, DL: 2, BL: 3, AH: 4, CH: 5, DH: 6, BH: 7 };
export const SEGR = { ES: 0, CS: 1, SS: 2, DS: 3 };
export const R8PARENT = { AL: ["AX", 0], AH: ["AX", 1], BL: ["BX", 0], BH: ["BX", 1], CL: ["CX", 0], CH: ["CX", 1], DL: ["DX", 0], DH: ["DX", 1] };

export const COND86 = {
  JE: 0x74, JZ: 0x74, JNE: 0x75, JNZ: 0x75, JC: 0x72, JB: 0x72, JNC: 0x73, JAE: 0x73,
  JS: 0x78, JNS: 0x79, JO: 0x70, JNO: 0x71, JA: 0x77, JBE: 0x76, JL: 0x7c, JGE: 0x7d,
  JG: 0x7f, JLE: 0x7e, JCXZ: 0xe3,
};
export const ALU86 = { ADD: 0, OR: 1, ADC: 2, SBB: 3, AND: 4, SUB: 5, XOR: 6, CMP: 7 };

/* Parse one 8086 operand into an IR node. */
export function parseOp86(tok, sym) {
  let t = tok.trim();
  let forced = 0;
  const ptr = t.match(/^(BYTE|WORD)\s+PTR\s+(.*)$/i);
  if (ptr) { forced = ptr[1].toUpperCase() === "BYTE" ? 1 : 2; t = ptr[2].trim(); }
  let segOverride = null;
  const so = t.match(/^(CS|DS|SS|ES)\s*:\s*(.*)$/i);
  if (so && so[2].startsWith("[")) { segOverride = so[1].toUpperCase(); t = so[2].trim(); }

  const up = t.toUpperCase();
  if (R16[up] !== undefined) return { k: "r", n: up, w: 2 };
  if (R8[up] !== undefined) return { k: "r8", n: up, w: 1 };
  if (SEGR[up] !== undefined) return { k: "sr", n: up, w: 2 };

  if (t.startsWith("[") && t.endsWith("]")) {
    const inner = t.slice(1, -1).trim();
    let base = null, index = null, dispStr = "";
    for (const piece of inner.split("+").map((x) => x.trim())) {
      const P = piece.toUpperCase();
      if (P === "BX" || P === "BP") base = P;
      else if (P === "SI" || P === "DI") index = P;
      else dispStr += (dispStr ? "+" : "") + piece;
    }
    let disp = 0;
    if (dispStr) {
      disp = evalExpr(dispStr, sym);
      if (Number.isNaN(disp)) disp = 0;
    }
    const seg = segOverride || (base === "BP" ? "SS" : "DS");
    return { k: "m", base, index, disp: u16(disp), seg, w: forced || 0, direct: !base && !index };
  }
  const v = evalExpr(t, sym);
  if (Number.isNaN(v)) return { k: "i", v: 0, w: forced || 0, unresolved: t.toUpperCase() };
  return { k: "i", v, w: forced || 0 };
}

/* mod/rm encoder for a memory or register operand. */
export function modrm86(op, regField) {
  if (op.k === "r" || op.k === "r8" || op.k === "sr") {
    const rmv = op.k === "r8" ? R8[op.n] : op.k === "sr" ? SEGR[op.n] : R16[op.n];
    return [0xc0 | (regField << 3) | rmv];
  }
  const key = `${op.base || ""}${op.index || ""}`;
  const table = { BXSI: 0, BXDI: 1, BPSI: 2, BPDI: 3, SI: 4, DI: 5, BP: 6, BX: 7 };
  if (op.direct) return [0x06 | (regField << 3), op.disp & 0xff, op.disp >> 8];
  const rmv = table[key];
  if (rmv === undefined) return [0x06 | (regField << 3), op.disp & 0xff, op.disp >> 8];
  if (op.disp === 0 && key !== "BP") return [(regField << 3) | rmv];
  if (op.disp < 0x100) return [0x40 | (regField << 3) | rmv, op.disp & 0xff];
  return [0x80 | (regField << 3) | rmv, op.disp & 0xff, op.disp >> 8];
}

export const eaCost = (op) => (op.k !== "m" ? 0 : op.direct ? 6 : op.base && op.index ? (op.disp ? 11 : 7) : op.disp ? 9 : 5);

/** Assemble one 8086 statement. Returns { bytes, t, tAlt, ir }. */
export function asm86(mn, rawOps, sym, pc, size) {
  const ops = rawOps.map((o) => parseOp86(o, sym));
  const B = (...b) => b.flat();
  const widthOf = (a, b) => (a && a.w) || (b && b.w) || 2;

  if (mn === "NOP") return { bytes: [0x90], t: 3, ir: { op: "NOP" } };
  if (mn === "HLT") return { bytes: [0xf4], t: 2, ir: { op: "HLT" } };
  if (mn === "CLC") return { bytes: [0xf8], t: 2, ir: { op: "CLC" } };
  if (mn === "STC") return { bytes: [0xf9], t: 2, ir: { op: "STC" } };
  if (mn === "CLD") return { bytes: [0xfc], t: 2, ir: { op: "CLD" } };
  if (mn === "STD") return { bytes: [0xfd], t: 2, ir: { op: "STD" } };
  if (mn === "CBW") return { bytes: [0x98], t: 2, ir: { op: "CBW" } };
  if (mn === "RET") return { bytes: [0xc3], t: 8, ir: { op: "RET" } };
  if (mn === "IRET") return { bytes: [0xcf], t: 24, ir: { op: "IRET" } };

  switch (mn) {
    case "MOV": {
      const [d, s] = ops;
      if (!d || !s) throw new Error("MOV expects 2 operands");
      const w = widthOf(d.k === "m" ? null : d, s.k === "m" ? null : s) || 2;
      if ((d.k === "r" || d.k === "r8") && s.k === "i") {
        const wide = d.k === "r";
        const code = (wide ? 0xb8 : 0xb0) + (wide ? R16[d.n] : R8[d.n]);
        return {
          bytes: wide ? [code, s.v & 0xff, (s.v >> 8) & 0xff] : [code, s.v & 0xff],
          t: 4, ir: { op: "MOV", d, s, w: wide ? 2 : 1 },
        };
      }
      if (d.k === "sr" || s.k === "sr") {
        const toSeg = d.k === "sr";
        const other = toSeg ? s : d;
        return {
          bytes: B(toSeg ? 0x8e : 0x8c, modrm86(other, SEGR[(toSeg ? d : s).n])),
          t: toSeg ? 2 : 2, ir: { op: "MOV", d, s, w: 2 },
        };
      }
      if (s.k === "i") {
        const wide = (d.w || 2) === 2;
        return {
          bytes: B(wide ? 0xc7 : 0xc6, modrm86(d, 0), wide ? [s.v & 0xff, (s.v >> 8) & 0xff] : [s.v & 0xff]),
          t: 10 + eaCost(d), ir: { op: "MOV", d, s, w: wide ? 2 : 1 },
        };
      }
      const wide = (s.k === "r" || d.k === "r") ? 2 : 1;
      if (d.k === "m") {
        return {
          bytes: B(wide === 2 ? 0x89 : 0x88, modrm86(d, wide === 2 ? R16[s.n] : R8[s.n])),
          t: 9 + eaCost(d), ir: { op: "MOV", d, s, w: wide },
        };
      }
      return {
        bytes: B(wide === 2 ? 0x8b : 0x8a, modrm86(s, wide === 2 ? R16[d.n] : R8[d.n])),
        t: s.k === "m" ? 8 + eaCost(s) : 2, ir: { op: "MOV", d, s, w: wide },
      };
    }
    case "ADD": case "SUB": case "CMP": case "AND": case "OR": case "XOR": case "ADC": case "SBB": {
      const [d, s] = ops;
      if (!d || !s) throw new Error(`${mn} expects 2 operands`);
      const digit = ALU86[mn];
      const wide = d.k === "r8" ? 1 : d.k === "m" ? (d.w || (s.k === "r8" ? 1 : 2)) : 2;
      if (s.k === "i") {
        return {
          bytes: B(wide === 2 ? 0x81 : 0x80, modrm86(d, digit), wide === 2 ? [s.v & 0xff, (s.v >> 8) & 0xff] : [s.v & 0xff]),
          t: (d.k === "m" ? 17 + eaCost(d) : 4), ir: { op: mn, d, s, w: wide },
        };
      }
      if (d.k === "m") {
        return {
          bytes: B((digit << 3) | (wide === 2 ? 0x01 : 0x00), modrm86(d, wide === 2 ? R16[s.n] : R8[s.n])),
          t: 16 + eaCost(d), ir: { op: mn, d, s, w: wide },
        };
      }
      return {
        bytes: B((digit << 3) | (wide === 2 ? 0x03 : 0x02), modrm86(s, wide === 2 ? R16[d.n] : R8[d.n])),
        t: s.k === "m" ? 9 + eaCost(s) : 3, ir: { op: mn, d, s, w: wide },
      };
    }
    case "INC": case "DEC": {
      const d = ops[0];
      if (!d) throw new Error(`${mn} expects 1 operand`);
      if (d.k === "r") {
        return { bytes: [(mn === "INC" ? 0x40 : 0x48) + R16[d.n]], t: 2, ir: { op: mn, d, w: 2 } };
      }
      const wide = d.k === "r8" ? 1 : (d.w || 2);
      return {
        bytes: B(wide === 2 ? 0xff : 0xfe, modrm86(d, mn === "INC" ? 0 : 1)),
        t: d.k === "m" ? 15 + eaCost(d) : 3, ir: { op: mn, d, w: wide },
      };
    }
    case "NEG": case "NOT": {
      const d = ops[0];
      const wide = d.k === "r8" ? 1 : (d.w || 2);
      return { bytes: B(wide === 2 ? 0xf7 : 0xf6, modrm86(d, mn === "NEG" ? 3 : 2)), t: 3, ir: { op: mn, d, w: wide } };
    }
    case "XCHG": {
      const [d, s] = ops;
      if (d.k === "r" && d.n === "AX" && s.k === "r") return { bytes: [0x90 + R16[s.n]], t: 3, ir: { op: "XCHG", d, s, w: 2 } };
      const wide = d.k === "r8" ? 1 : 2;
      return { bytes: B(wide === 2 ? 0x87 : 0x86, modrm86(s, wide === 2 ? R16[d.n] : R8[d.n])), t: 4, ir: { op: "XCHG", d, s, w: wide } };
    }
    case "PUSH": case "POP": {
      const d = ops[0];
      if (d.k === "r") return { bytes: [(mn === "PUSH" ? 0x50 : 0x58) + R16[d.n]], t: mn === "PUSH" ? 11 : 8, ir: { op: mn, d } };
      if (d.k === "sr") return { bytes: [(mn === "PUSH" ? 0x06 : 0x07) | (SEGR[d.n] << 3)], t: 10, ir: { op: mn, d } };
      return { bytes: B(mn === "PUSH" ? 0xff : 0x8f, modrm86(d, mn === "PUSH" ? 6 : 0)), t: 16, ir: { op: mn, d } };
    }
    case "PUSHF": return { bytes: [0x9c], t: 10, ir: { op: "PUSHF" } };
    case "POPF": return { bytes: [0x9d], t: 8, ir: { op: "POPF" } };
    case "INT": {
      const n = ops[0].k === "i" ? u8(ops[0].v) : 0;
      return { bytes: n === 3 ? [0xcc] : [0xcd, n], t: 51, ir: { op: "INT", n } };
    }
    case "IN": case "OUT": {
      const [a, b] = ops;
      const port = mn === "IN" ? b : a;
      const acc = mn === "IN" ? a : b;
      const wide = acc && acc.k === "r" ? 2 : 1;
      if (port.k === "i") {
        return {
          bytes: [(mn === "IN" ? 0xe4 : 0xe6) + (wide === 2 ? 1 : 0), u8(port.v)],
          t: 10, ir: { op: mn, port: { k: "i", v: u8(port.v) }, w: wide },
        };
      }
      return {
        bytes: [(mn === "IN" ? 0xec : 0xee) + (wide === 2 ? 1 : 0)],
        t: 8, ir: { op: mn, port: { k: "dx" }, w: wide },
      };
    }
    case "JMP": {
      const d = ops[0];
      const target = u16(d.k === "i" ? d.v : 0);
      const rel = target - (pc + 3);
      return { bytes: [0xe9, rel & 0xff, (rel >> 8) & 0xff], t: 15, ir: { op: "JMP", a: target } };
    }
    case "CALL": {
      const target = u16(ops[0].k === "i" ? ops[0].v : 0);
      const rel = target - (pc + 3);
      return { bytes: [0xe8, rel & 0xff, (rel >> 8) & 0xff], t: 19, ir: { op: "CALL", a: target } };
    }
    case "LOOP": case "LOOPE": case "LOOPNE": {
      const target = u16(ops[0].k === "i" ? ops[0].v : 0);
      const rel = target - (pc + 2);
      const code = { LOOP: 0xe2, LOOPE: 0xe1, LOOPNE: 0xe0 }[mn];
      return { bytes: [code, rel & 0xff], t: 17, tAlt: 5, ir: { op: mn, a: target } };
    }
    default: break;
  }
  if (COND86[mn] !== undefined) {
    const target = u16(ops[0].k === "i" ? ops[0].v : 0);
    const rel = target - (pc + 2);
    return { bytes: [COND86[mn], rel & 0xff], t: 16, tAlt: 4, ir: { op: mn, a: target } };
  }
  throw new Error(`unknown 8086 mnemonic "${mn}"`);
}

