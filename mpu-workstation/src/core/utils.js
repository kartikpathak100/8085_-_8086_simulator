/* Numeric helpers, literal evaluation and line lexing. */

/* ============================ 0b. HELPERS ================================= */

export const hex = (v, w = 2) => (v >>> 0).toString(16).toUpperCase().padStart(w, "0");
export const bin = (v, w = 8) => (v >>> 0).toString(2).padStart(w, "0");
export const u8 = (v) => v & 0xff;
export const u16 = (v) => v & 0xffff;
export const s8 = (v) => ((v & 0xff) ^ 0x80) - 0x80;

export const parityOf = (v) => {
  let c = 0, x = v & 0xff;
  while (x) { c += x & 1; x >>= 1; }
  return c % 2 === 0 ? 1 : 0;
};

export const MEM_SIZE = 0x100000; // 1 MB physical space (8085 is masked to 64 KB)

/* Numeric literal / symbol evaluation ------------------------------------- */

export function evalTerm(tok, sym) {
  const t = tok.trim();
  if (!t) return NaN;
  if (/^'.'$/.test(t)) return t.charCodeAt(1);
  if (/^0x[0-9a-f]+$/i.test(t)) return parseInt(t.slice(2), 16);
  if (/^[0-9][0-9a-f]*h$/i.test(t)) return parseInt(t.slice(0, -1), 16);
  if (/^[01]+b$/i.test(t)) return parseInt(t.slice(0, -1), 2);
  if (/^[0-9]+d?$/i.test(t)) return parseInt(t.replace(/d$/i, ""), 10);
  if (sym && Object.prototype.hasOwnProperty.call(sym, t.toUpperCase())) {
    return sym[t.toUpperCase()];
  }
  return NaN;
}

export function evalExpr(str, sym) {
  const parts = String(str).match(/[+-]?[^+-]+/g);
  if (!parts) return NaN;
  let sum = 0;
  for (const raw of parts) {
    let p = raw.trim(), sign = 1;
    if (p[0] === "+") p = p.slice(1);
    else if (p[0] === "-") { sign = -1; p = p.slice(1); }
    const v = evalTerm(p, sym);
    if (Number.isNaN(v)) return NaN;
    sum += sign * v;
  }
  return sum;
}

/* Split an operand list on commas that sit outside quotes/brackets --------- */
export function splitOperands(str) {
  const out = [];
  let depth = 0, quote = null, cur = "";
  for (const ch of str) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') { quote = ch; cur += ch; continue; }
    if (ch === "[") depth++;
    if (ch === "]") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/* Strip comments, isolate an optional label ------------------------------- */
export function lexLine(raw) {
  const text = raw;
  // strip the comment while respecting quoted characters
  let out = "", quote = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) { out += ch; if (ch === quote) quote = null; continue; }
    if (ch === "'" || ch === '"') { quote = ch; out += ch; continue; }
    if (ch === ";") break;
    out += ch;
  }
  out = out.trim();
  let label = null;
  const m = out.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
  if (m) { label = m[1].toUpperCase(); out = m[2].trim(); }
  if (!out) return { label, mnemonic: null, operands: [] };
  const sp = out.match(/^(\S+)\s*(.*)$/);
  return {
    label,
    mnemonic: sp[1].toUpperCase(),
    operands: sp[2] ? splitOperands(sp[2]) : [],
  };
}

