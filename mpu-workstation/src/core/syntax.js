/* Token sets used by the editor's syntax highlighter. */

import { SIMPLE85, ALU85, ALUI85, JMP85, CALL85, RET85 } from './isa8085.js';
import { R16, R8, SEGR, COND86 } from './isa8086.js';

export const MNEMONICS = {
  "8085": new Set([
    ...Object.keys(SIMPLE85), ...Object.keys(ALU85), ...Object.keys(ALUI85),
    ...Object.keys(JMP85), ...Object.keys(CALL85), ...Object.keys(RET85),
    "MOV", "MVI", "LXI", "LDA", "STA", "LHLD", "SHLD", "LDAX", "STAX", "INR", "DCR",
    "INX", "DCX", "DAD", "PUSH", "POP", "IN", "OUT", "RST",
  ]),
  "8086": new Set([
    "MOV", "ADD", "SUB", "CMP", "AND", "OR", "XOR", "ADC", "SBB", "INC", "DEC",
    "NEG", "NOT", "XCHG", "PUSH", "POP", "PUSHF", "POPF", "INT", "IRET", "IN", "OUT",
    "JMP", "CALL", "RET", "LOOP", "LOOPE", "LOOPNE", "NOP", "HLT", "CLC", "STC",
    "CLD", "STD", "CBW", ...Object.keys(COND86),
  ]),
};
export const REGNAMES = {
  "8085": new Set(["A", "B", "C", "D", "E", "H", "L", "M", "SP", "PC", "PSW"]),
  "8086": new Set([...Object.keys(R16), ...Object.keys(R8), ...Object.keys(SEGR), "IP"]),
};
export const DIRECTIVES = new Set(["ORG", "DB", "DW", "EQU"]);


