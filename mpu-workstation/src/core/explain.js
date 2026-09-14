/* Turns an assembled statement into a sentence a first-year student can read. */

const PLACE = {
  M: 'the byte HL points at',
  PSW: 'A together with the flags',
};

const pretty = (tok = '') => {
  const t = tok.trim().toUpperCase();
  if (PLACE[t]) return PLACE[t];
  if (t.startsWith('[') && t.endsWith(']')) {
    const inner = t.slice(1, -1);
    return /^[0-9]/.test(inner) ? `memory at ${inner}` : `the memory ${inner} points at`;
  }
  return tok.trim();
};

const pair = (rp = '') => {
  const t = rp.trim().toUpperCase();
  return { B: 'BC', D: 'DE', H: 'HL', SP: 'SP' }[t] || t;
};

const IF = {
  Z: 'the last result was zero',
  NZ: 'the last result was not zero',
  C: 'the last operation carried',
  NC: 'the last operation did not carry',
  E: 'the two values were equal',
  NE: 'the two values were different',
  S: 'the result was negative',
  NS: 'the result was not negative',
  A: 'the first value was larger',
  B: 'the first value was smaller',
  BE: 'the first value was smaller or equal',
  AE: 'the first value was larger or equal',
};

export function describe(ins, arch) {
  if (!ins) return 'Nothing to run here.';
  if (ins.isData) return `Stored data — ${ins.bytes.length} byte${ins.bytes.length === 1 ? '' : 's'} placed in memory.`;

  const mn = ins.mnemonic;
  const o = ins.operands.map(pretty);
  const raw = ins.operands.map((x) => x.trim().toUpperCase());

  const common = {
    MOV: () => `Copy ${o[1]} into ${o[0]}.`,
    MVI: () => `Put the value ${o[1]} into ${o[0]}.`,
    LXI: () => `Point ${pair(raw[0])} at address ${o[1]}.`,
    LDA: () => `Load the byte stored at ${o[0]} into A.`,
    STA: () => `Store A into memory at ${o[0]}.`,
    ADD: () => (arch === '8085' ? `Add ${o[0]} to A.` : `Add ${o[1]} to ${o[0]}.`),
    ADI: () => `Add ${o[0]} to A.`,
    SUB: () => (arch === '8085' ? `Subtract ${o[0]} from A.` : `Subtract ${o[1]} from ${o[0]}.`),
    SUI: () => `Subtract ${o[0]} from A.`,
    INR: () => `Add one to ${o[0]}.`,
    DCR: () => `Take one away from ${o[0]}.`,
    INC: () => `Add one to ${o[0]}.`,
    DEC: () => `Take one away from ${o[0]}.`,
    INX: () => `Move the ${pair(raw[0])} pointer forward by one.`,
    DCX: () => `Move the ${pair(raw[0])} pointer back by one.`,
    DAD: () => `Add ${pair(raw[0])} to HL.`,
    CMP: () => (arch === '8085' ? `Compare A with ${o[0]} and set the flags.` : `Compare ${o[0]} with ${o[1]} and set the flags.`),
    CPI: () => `Compare A with ${o[0]} and set the flags.`,
    XCHG: () => 'Swap the contents of HL and DE.',
    JMP: () => `Jump to ${o[0]}.`,
    CALL: () => `Call the routine at ${o[0]} and remember where to come back to.`,
    RET: () => 'Return to whoever called this routine.',
    IRET: () => 'Return from the interrupt handler.',
    PUSH: () => `Save ${o[0]} on the stack.`,
    POP: () => `Take the top of the stack back into ${o[0]}.`,
    IN: () => `Read input port ${o[o.length - 1]} into ${arch === '8085' ? 'A' : o[0]}.`,
    OUT: () => `Send ${arch === '8085' ? 'A' : o[1]} out to port ${o[0]}.`,
    HLT: () => 'Stop the processor.',
    NOP: () => 'Do nothing for one instruction.',
    INT: () => `Raise software interrupt ${o[0]}.`,
    LOOP: () => `Go back to ${o[0]} until CX counts down to zero.`,
    AND: () => `Bitwise AND ${o[1]} into ${o[0]}.`,
    ANA: () => `Bitwise AND ${o[0]} into A.`,
    ANI: () => `Bitwise AND ${o[0]} into A.`,
    ORA: () => `Bitwise OR ${o[0]} into A.`,
    XRA: () => `Bitwise XOR ${o[0]} into A.`,
    CMA: () => 'Flip every bit of A.',
    STC: () => 'Set the carry flag.',
    CMC: () => 'Flip the carry flag.',
    RLC: () => 'Rotate A one place to the left.',
    RRC: () => 'Rotate A one place to the right.',
  };

  if (common[mn]) return common[mn]();

  const j = mn.match(/^J(N?[ZCESAB]E?|NE|NC|NZ|NS|AE|BE)$/);
  if (j && IF[j[1]]) return `Jump to ${o[0]} if ${IF[j[1]]}.`;
  if (/^J/.test(mn)) return `Jump to ${o[0]} when the matching condition holds.`;
  if (/^R[ZCN]/.test(mn)) return 'Return to the caller when the matching condition holds.';
  if (/^C[ZCN]/.test(mn)) return `Call ${o[0]} when the matching condition holds.`;

  return `Run ${mn}${o.length ? ' ' + o.join(', ') : ''}.`;
}

/** Human summary of what one step altered, e.g. ["A 00 → 38", "Z 0 → 1"]. */
export function changeList(before, after, hexf) {
  const out = [];
  for (const k of Object.keys(after.regs)) {
    if (after.regs[k] !== before.regs[k]) {
      const w = k === 'PC' || k === 'SP' || k === 'IP' || k.length === 2 ? 4 : 2;
      out.push(`${k} ${hexf(before.regs[k], w)} → ${hexf(after.regs[k], w)}`);
    }
  }
  for (const k of Object.keys(after.flags)) {
    if (after.flags[k] !== before.flags[k]) out.push(`${k} ${before.flags[k]} → ${after.flags[k]}`);
  }
  return out;
}
