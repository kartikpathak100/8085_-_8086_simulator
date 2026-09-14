/* Colour tokens. Each one points at a CSS variable defined in index.css, so
   the same component code renders correctly in either theme. */

export const T = {
  base: 'var(--c-base)',
  panel: 'var(--c-panel)',
  deep: 'var(--c-deep)',
  rail: 'var(--c-rail)',
  line: 'var(--c-line)',
  lineSoft: 'var(--c-line-soft)',
  text: 'var(--c-text)',
  dim: 'var(--c-dim)',
  dimmer: 'var(--c-dimmer)',
  accent: 'var(--c-accent)',
  accentText: 'var(--c-accent-text)',
  green: 'var(--c-green)',
  red: 'var(--c-red)',
  amber: 'var(--c-amber)',
  blue: 'var(--c-blue)',
  purple: 'var(--c-purple)',
  orange: 'var(--c-orange)',
  white: 'var(--c-strong)',
  comment: 'var(--c-comment)',
  number: 'var(--c-number)',
  ident: 'var(--c-ident)',

  hl: 'var(--c-hl)',
  hlSoft: 'var(--c-hl-soft)',
  hlFaint: 'var(--c-hl-faint)',
  okWash: 'var(--c-ok-wash)',
  okLine: 'var(--c-ok-line)',
  errWash: 'var(--c-err-wash)',
  read: 'var(--c-read)',
  write: 'var(--c-write)',
  exec: 'var(--c-exec)',

  grid: 'var(--c-grid)',
  gridStrong: 'var(--c-grid-strong)',
  displayBg: 'var(--c-display-bg)',
  segOn: 'var(--c-seg-on)',
  segOff: 'var(--c-seg-off)',
  ledOn: 'var(--c-led-on)',
  ledOff: 'var(--c-led-off)',

  shadowCard: 'var(--shadow-card)',
  shadowFloat: 'var(--shadow-float)',
  headerGrad: 'var(--header-grad)',
};

export const MONO =
  "'JetBrains Mono','SFMono-Regular',Menlo,Consolas,'Liberation Mono',monospace";

export const mono = { fontFamily: MONO };

/** Canvas needs real colour strings, not var() references. */
export function resolveColors(el, names) {
  const cs = getComputedStyle(el || document.documentElement);
  const out = {};
  for (const n of names) out[n] = cs.getPropertyValue(`--c-${n}`).trim() || '#888';
  return out;
}
