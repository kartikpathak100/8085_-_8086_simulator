/* Intel 8085 instruction encodings and single-statement assembler. */

import { u8, u16, evalExpr } from './utils.js';

/* ======================== 1a. 8085 INSTRUCTION SET ======================== */

export const R85 = { B: 0, C: 1, D: 2, E: 3, H: 4, L: 5, M: 6, A: 7 };
export const R85NAME = ["B", "C", "D", "E", "H", "L", "M", "A"];
export const RP85 = { B: 0, D: 1, H: 2, SP: 3 };
export const RPP85 = { B: 0, D: 1, H: 2, PSW: 3 };

export const ALU85 = { ADD: 0x80, ADC: 0x88, SUB: 0x90, SBB: 0x98, ANA: 0xa0, XRA: 0xa8, ORA: 0xb0, CMP: 0xb8 };
export const ALUI85 = { ADI: 0xc6, ACI: 0xce, SUI: 0xd6, SBI: 0xde, ANI: 0xe6, XRI: 0xee, ORI: 0xf6, CPI: 0xfe };
export const JMP85 = { JMP: 0xc3, JNZ: 0xc2, JZ: 0xca, JNC: 0xd2, JC: 0xda, JPO: 0xe2, JPE: 0xea, JP: 0xf2, JM: 0xfa };
export const CALL85 = { CALL: 0xcd, CNZ: 0xc4, CZ: 0xcc, CNC: 0xd4, CC: 0xdc };
export const RET85 = { RET: 0xc9, RNZ: 0xc0, RZ: 0xc8, RNC: 0xd0, RC: 0xd8 };
export const SIMPLE85 = {
  NOP: [0x00, 4], HLT: [0x76, 5], XCHG: [0xeb, 4], XTHL: [0xe3, 16], SPHL: [0xf9, 6],
  PCHL: [0xe9, 6], RLC: [0x07, 4], RRC: [0x0f, 4], RAL: [0x17, 4], RAR: [0x1f, 4],
  CMA: [0x2f, 4], CMC: [0x3f, 4], STC: [0x37, 4], DAA: [0x27, 4], EI: [0xfb, 4], DI: [0xf3, 4],
};

export function reg85(tok) {
  const r = R85[String(tok).toUpperCase()];
  if (r === undefined) throw new Error(`unknown register "${tok}"`);
  return r;
}

/** Assemble one 8085 statement. Returns { bytes, t, tAlt, ir }. */
export function asm85(mn, ops, sym) {
  const imm = (i) => {
    const v = evalExpr(ops[i], sym);
    if (Number.isNaN(v)) throw new Error(`bad operand "${ops[i]}"`);
    return v;
  };
  const need = (n) => { if (ops.length !== n) throw new Error(`${mn} expects ${n} operand(s)`); };

  if (SIMPLE85[mn]) {
    const [op, t] = SIMPLE85[mn];
    return { bytes: [op], t, ir: { op: mn } };
  }
  switch (mn) {
    case "MOV": {
      need(2);
      const d = reg85(ops[0]), s = reg85(ops[1]);
      if (d === 6 && s === 6) throw new Error("MOV M,M is HLT-encoded, not allowed");
      return { bytes: [0x40 | (d << 3) | s], t: d === 6 || s === 6 ? 7 : 4, ir: { op: "MOV", d, s } };
    }
    case "MVI": {
      need(2);
      const d = reg85(ops[0]), v = u8(imm(1));
      return { bytes: [0x06 | (d << 3), v], t: d === 6 ? 10 : 7, ir: { op: "MVI", d, v } };
    }
    case "LXI": {
      need(2);
      const rp = RP85[ops[0].toUpperCase()];
      if (rp === undefined) throw new Error(`LXI needs B, D, H or SP`);
      const v = u16(imm(1));
      return { bytes: [0x01 | (rp << 4), v & 0xff, v >> 8], t: 10, ir: { op: "LXI", rp, v } };
    }
    case "LDA": case "STA": case "LHLD": case "SHLD": {
      need(1);
      const v = u16(imm(0));
      const codes = { LDA: 0x3a, STA: 0x32, LHLD: 0x2a, SHLD: 0x22 };
      const ts = { LDA: 13, STA: 13, LHLD: 16, SHLD: 16 };
      return { bytes: [codes[mn], v & 0xff, v >> 8], t: ts[mn], ir: { op: mn, a: v } };
    }
    case "LDAX": case "STAX": {
      need(1);
      const rp = RP85[ops[0].toUpperCase()];
      if (rp !== 0 && rp !== 1) throw new Error(`${mn} needs B or D`);
      return { bytes: [(mn === "LDAX" ? 0x0a : 0x02) | (rp << 4)], t: 7, ir: { op: mn, rp } };
    }
    case "INR": case "DCR": {
      need(1);
      const d = reg85(ops[0]);
      return {
        bytes: [(mn === "INR" ? 0x04 : 0x05) | (d << 3)],
        t: d === 6 ? 10 : 4, ir: { op: mn, d },
      };
    }
    case "INX": case "DCX": {
      need(1);
      const rp = RP85[ops[0].toUpperCase()];
      if (rp === undefined) throw new Error(`${mn} needs B, D, H or SP`);
      return { bytes: [(mn === "INX" ? 0x03 : 0x0b) | (rp << 4)], t: 6, ir: { op: mn, rp } };
    }
    case "DAD": {
      need(1);
      const rp = RP85[ops[0].toUpperCase()];
      if (rp === undefined) throw new Error("DAD needs B, D, H or SP");
      return { bytes: [0x09 | (rp << 4)], t: 10, ir: { op: "DAD", rp } };
    }
    case "PUSH": case "POP": {
      need(1);
      const rp = RPP85[ops[0].toUpperCase()];
      if (rp === undefined) throw new Error(`${mn} needs B, D, H or PSW`);
      return {
        bytes: [(mn === "PUSH" ? 0xc5 : 0xc1) | (rp << 4)],
        t: mn === "PUSH" ? 12 : 10, ir: { op: mn, rp },
      };
    }
    case "IN": case "OUT": {
      need(1);
      const p = u8(imm(0));
      return { bytes: [mn === "IN" ? 0xdb : 0xd3, p], t: 10, ir: { op: mn, p } };
    }
    case "RST": {
      need(1);
      const n = imm(0) & 7;
      return { bytes: [0xc7 | (n << 3)], t: 12, ir: { op: "RST", n } };
    }
    default: break;
  }
  if (ALU85[mn]) {
    const s = reg85(ops[0]);
    return { bytes: [ALU85[mn] | s], t: s === 6 ? 7 : 4, ir: { op: mn, s } };
  }
  if (ALUI85[mn]) {
    const v = u8(imm(0));
    return { bytes: [ALUI85[mn], v], t: 7, ir: { op: mn, v } };
  }
  if (JMP85[mn]) {
    const a = u16(imm(0));
    return { bytes: [JMP85[mn], a & 0xff, a >> 8], t: 10, tAlt: 7, ir: { op: mn, a } };
  }
  if (CALL85[mn]) {
    const a = u16(imm(0));
    return { bytes: [CALL85[mn], a & 0xff, a >> 8], t: 18, tAlt: 9, ir: { op: mn, a } };
  }
  if (RET85[mn]) {
    return { bytes: [RET85[mn]], t: mn === "RET" ? 10 : 12, tAlt: 6, ir: { op: mn } };
  }
  throw new Error(`unknown 8085 mnemonic "${mn}"`);
}

