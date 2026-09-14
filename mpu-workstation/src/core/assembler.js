/* Two-pass assembler shared by both architectures. */

import { u16, evalExpr, lexLine } from './utils.js';
import { asm85 } from './isa8085.js';
import { asm86 } from './isa8086.js';

/* ============================ 1c. ASSEMBLER =============================== */

export const DEFAULT_ORG = { "8085": 0x2000, "8086": 0x0100 };

export function assemble(source, arch) {
  const lines = source.replace(/\r/g, "").split("\n");
  const errors = [];
  const symbols = {};
  let pc = DEFAULT_ORG[arch];

  const parsed = lines.map((raw, i) => ({ raw, i, ...lexLine(raw) }));

  /* ---- pass 1: sizes and label addresses ---- */
  for (const p of parsed) {
    if (p.label) symbols[p.label] = pc;
    if (!p.mnemonic) continue;
    const mn = p.mnemonic;
    try {
      if (mn === "ORG") { pc = u16(evalExpr(p.operands[0], symbols)); continue; }
      if (mn === "EQU") continue;
      if (mn === "DB" || mn === "DW") {
        let n = 0;
        for (const o of p.operands) {
          const str = o.match(/^'(.*)'$/) || o.match(/^"(.*)"$/);
          if (str && str[1].length > 1) n += str[1].length * (mn === "DW" ? 2 : 1);
          else n += mn === "DW" ? 2 : 1;
        }
        p.size = n; pc += n; continue;
      }
      const r = arch === "8085" ? asm85(mn, p.operands, symbols) : asm86(mn, p.operands, symbols, pc, 0);
      p.size = r.bytes.length;
      pc += r.bytes.length;
    } catch (e) {
      p.size = arch === "8085" ? 3 : 3;
      pc += p.size;
    }
  }

  /* ---- pass 2: encode ---- */
  pc = DEFAULT_ORG[arch];
  const instructions = [];
  const image = [];
  for (const p of parsed) {
    if (!p.mnemonic) continue;
    const mn = p.mnemonic;
    try {
      if (mn === "ORG") { pc = u16(evalExpr(p.operands[0], symbols)); continue; }
      if (mn === "EQU") {
        if (p.label) symbols[p.label] = evalExpr(p.operands[0], symbols);
        continue;
      }
      if (mn === "DB" || mn === "DW") {
        const bytes = [];
        for (const o of p.operands) {
          const str = o.match(/^'(.*)'$/) || o.match(/^"(.*)"$/);
          if (str && str[1].length > 1) {
            for (const ch of str[1]) {
              bytes.push(ch.charCodeAt(0));
              if (mn === "DW") bytes.push(0);
            }
          } else {
            const v = evalExpr(o, symbols);
            if (Number.isNaN(v)) throw new Error(`bad data value "${o}"`);
            bytes.push(v & 0xff);
            if (mn === "DW") bytes.push((v >> 8) & 0xff);
          }
        }
        instructions.push({
          addr: pc, bytes, line: p.i, src: p.raw, mnemonic: mn,
          operands: p.operands, isData: true, t: 0,
        });
        bytes.forEach((b, k) => image.push([pc + k, b]));
        pc += bytes.length;
        continue;
      }
      const r = arch === "8085" ? asm85(mn, p.operands, symbols) : asm86(mn, p.operands, symbols, pc, p.size);
      instructions.push({
        addr: pc, bytes: r.bytes, t: r.t, tAlt: r.tAlt, ir: r.ir,
        line: p.i, src: p.raw, mnemonic: mn, operands: p.operands,
      });
      r.bytes.forEach((b, k) => image.push([pc + k, b & 0xff]));
      pc += r.bytes.length;
    } catch (e) {
      errors.push({ line: p.i, msg: e.message });
      pc += p.size || 1;
    }
  }

  const addrMap = new Map();
  instructions.forEach((ins, idx) => { if (!ins.isData) addrMap.set(ins.addr, idx); });

  const entry = instructions.find((i) => !i.isData);
  return {
    ok: errors.length === 0,
    errors, symbols, instructions, image, addrMap,
    entry: entry ? entry.addr : DEFAULT_ORG[arch],
    size: image.length,
  };
}

