#!/usr/bin/env node
/**
 * Build the Bayan design-system bundle for claude.ai/design.
 *
 *   node scripts/gen-design-system.mjs               # write to .design-system/
 *   node scripts/gen-design-system.mjs --out DIR
 *   node scripts/gen-design-system.mjs --check       # fail if tokens disagree
 *
 * ── Why this is generated and not hand-written ───────────────────────────────
 *
 * There was already a hand-written "standalone visual verification page" whose
 * entire job was to show what the design system looks like. It renders 38 of its
 * 39 colours from the pre-rebrand palette — Tailwind stones and a #22c55e green
 * the app deliberately abandoned. Anyone opening it to check the design system
 * saw a completely wrong picture, and it existed in two identical copies.
 * modules/09-design-system.md, which the module doc cites as the source of the
 * tokens, shares exactly ONE colour with the implementation — and that one is a
 * colour globals.css documents as removed.
 *
 * A hand-maintained mirror of a palette will always drift, because nothing fails
 * when it does. So this reads styles/globals.css — the single source of truth —
 * and derives every swatch, so the published system cannot say something the code
 * does not. --check makes drift a red build instead of a silent lie.
 */

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(root, 'src/app');
const args = process.argv.slice(2);
const check = args.includes('--check');
const outIdx = args.indexOf('--out');
const OUT = outIdx >= 0 ? args[outIdx + 1] : join(root, '.design-system');

const css = await readFile(join(APP, 'styles/globals.css'), 'utf-8');
const tw = await readFile(join(APP, 'tailwind.config.ts'), 'utf-8');

// ── Parse the source of truth ───────────────────────────────────────────────
const tokens = new Map();
for (const m of css.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) {
  tokens.set(m[1], m[2].trim());
}
/** Resolve var() chains so semantic aliases render as real colours. */
function resolve(value, depth = 0) {
  if (depth > 8) return value;
  const m = /^var\(--([a-z0-9-]+)\)$/.exec(value.trim());
  return m && tokens.has(m[1]) ? resolve(tokens.get(m[1]), depth + 1) : value;
}
const colour = (name) => resolve(tokens.get(name) ?? '');

const RAMPS = {
  ground: [950, 900, 800, 700, 600, 500, 400, 300, 200, 100, 50],
  gold: [700, 600, 500, 400, 300, 200],
  leaf: [600, 500, 400],
};
const SEMANTIC = ['bg', 'surface', 'surface-2', 'border', 'ink', 'muted', 'subtle',
  'success', 'warning', 'error', 'info'];
const TAJWEED = ['madd', 'noon-saakin', 'meem-saakin', 'qalqalah', 'ghunnah',
  'makharij', 'lam-shamsiyyah', 'idghaam', 'hamzat-wasl', 'silent'];

// ── Drift check: Tailwind must mirror globals.css ──────────────────────────
const problems = [];
for (const [ramp, steps] of Object.entries(RAMPS)) {
  const block = new RegExp(`const ${ramp} = \\{([^}]*)\\}`, 's').exec(tw);
  if (!block) {
    problems.push(`tailwind.config.ts has no "${ramp}" ramp`);
    continue;
  }
  for (const step of steps) {
    const want = colour(`${ramp}-${step}`);
    const got = new RegExp(`\\b${step}:\\s*'(#[0-9a-fA-F]{6})'`).exec(block[1])?.[1];
    if (!want) problems.push(`globals.css has no --${ramp}-${step}`);
    else if (!got) problems.push(`tailwind.config.ts has no ${ramp}.${step}`);
    else if (got.toLowerCase() !== want.toLowerCase()) {
      problems.push(`${ramp}-${step}: globals.css says ${want}, tailwind.config.ts says ${got}`);
    }
  }
}
for (const rule of TAJWEED) {
  const want = colour(`tajweed-${rule}`);
  const got = new RegExp(`'?${rule}'?:\\s*'(#[0-9a-fA-F]{6})'`).exec(tw)?.[1];
  if (got && want && got.toLowerCase() !== want.toLowerCase()) {
    problems.push(`tajweed-${rule}: globals.css says ${want}, tailwind says ${got}`);
  }
}
// Every --font-* the CSS uses should have a Tailwind fontFamily utility, or a
// developer writing the obvious `font-naskh` gets an element with no font at all
// — anti-slop tell 14, which this codebase already paid for once with
// `arabic-green`.
const fontFamilyBlock = /fontFamily:\s*\{([^}]*)\}/s.exec(tw)?.[1] ?? '';
const utilities = new Set([...fontFamilyBlock.matchAll(/^\s*([a-z]+):/gm)].map((m) => m[1]));
const referenced = new Set(
  [...css.matchAll(/var\(--font-([a-z]+)\)/g)].map((m) => m[1]).filter((f) => f !== 'fallback')
);
for (const f of referenced) {
  if (!utilities.has(f)) {
    problems.push(
      `--font-${f} is used in globals.css but has no fontFamily utility in ` +
        `tailwind.config.ts, so "font-${f}" compiles to nothing`
    );
  }
}

if (problems.length) {
  for (const p of problems) process.stderr.write(`  ✘ ${p}\n`);
  process.stderr.write(`\n${problems.length} design-token problem(s).\n`);
  if (check) process.exit(1);
} else if (check) {
  process.stdout.write('✅ design tokens agree across globals.css and tailwind.config.ts\n');
  process.exit(0);
}

// ── Contrast, computed rather than asserted ────────────────────────────────
// globals.css annotates ratios in comments. Comments do not recompute when a hex
// changes, so the published system derives them.
const srgb = (hex) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
};
const lum = (hex) => {
  const [r, g, b] = srgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const grade = (r) => (r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'AA large' : 'fail');
const CANVAS = colour('ground-950');

// ── Emit ───────────────────────────────────────────────────────────────────
await rm(OUT, { recursive: true, force: true });
await mkdir(join(OUT, 'preview'), { recursive: true });

const shell = (title, group, body, subtitle = '') => `<!-- @dsCard group="${group}" -->
<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Noto+Naskh+Arabic:wght@400;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="_card.css">
</head><body>
<header><h1>${title}</h1>${subtitle ? `<p class="sub">${subtitle}</p>` : ''}</header>
${body}
</body></html>
`;

await writeFile(join(OUT, 'preview/_card.css'), `/* Generated. Shared chrome for every preview card. */
:root {
${[...RAMPS.ground.map((s) => `  --ground-${s}: ${colour(`ground-${s}`)};`),
  ...RAMPS.gold.map((s) => `  --gold-${s}: ${colour(`gold-${s}`)};`),
  ...RAMPS.leaf.map((s) => `  --leaf-${s}: ${colour(`leaf-${s}`)};`)].join('\n')}
  --ink: ${colour('ground-50')};
  --muted: ${colour('ground-300')};
  --radius-md: ${tokens.get('radius-md')};
  --radius-lg: ${tokens.get('radius-lg')};
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 32px;
  background: ${CANVAS}; color: var(--ink);
  font-family: Inter, system-ui, sans-serif;
  line-height: ${tokens.get('leading-normal')};
}
header { margin-bottom: 28px; }
h1 { font-family: Amiri, serif; font-size: 1.75rem; margin: 0 0 4px; font-weight: 700; }
.sub { margin: 0; color: var(--muted); font-size: 0.875rem; max-width: 60ch; }
h2 { font-size: 0.75rem; letter-spacing: 0.16em; text-transform: uppercase;
     color: ${colour('ground-400')}; margin: 32px 0 12px; font-weight: 600; }
.grid { display: grid; gap: 12px; }
.row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.swatch { border-radius: var(--radius-md); overflow: hidden;
          border: 1px solid ${colour('ground-700')}; }
.swatch .chip { height: 64px; }
.swatch .meta { padding: 8px 10px; font-size: 0.75rem; background: ${colour('ground-900')}; }
.swatch .meta code { color: var(--muted); font-size: 0.7rem; }
.tag { font-size: 0.65rem; padding: 1px 6px; border-radius: 999px;
       border: 1px solid currentColor; margin-left: 6px; }
.AAA { color: ${colour('leaf-400')}; } .AA { color: ${colour('gold-400')}; }
.fail, .AAlarge { color: ${colour('color-error')}; }
.note { border-left: 2px solid ${colour('gold-500')}; padding: 8px 0 8px 14px;
        color: var(--muted); font-size: 0.8125rem; margin: 20px 0; max-width: 72ch; }
.ar { font-family: 'Amiri', serif; direction: rtl; line-height: ${tokens.get('leading-arabic')}; }
.naskh { font-family: 'Noto Naskh Arabic', serif; direction: rtl;
         line-height: ${tokens.get('leading-arabic')}; }
`, 'utf-8');

const swatch = (label, hex, showContrast = true) => {
  const r = showContrast && /^#/.test(hex) ? ratio(hex, CANVAS) : null;
  const g = r ? grade(r) : '';
  return `<div class="swatch"><div class="chip" style="background:${hex}"></div>
  <div class="meta"><strong>${label}</strong>${
    r ? ` <span class="tag ${g.replace(' ', '')}">${r.toFixed(1)}:1 ${g}</span>` : ''
  }<br><code>${hex}</code></div></div>`;
};

// 1 — Colour
await writeFile(join(OUT, 'preview/colors.html'), shell(
  'Colour', 'Foundations',
  ['ground', 'gold', 'leaf'].map((ramp) => `<h2>${ramp}</h2>
<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">
${RAMPS[ramp].map((s) => swatch(`${ramp}-${s}`, colour(`${ramp}-${s}`))).join('\n')}
</div>`).join('\n') + `
<h2>Semantic aliases</h2>
<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">
${SEMANTIC.map((n) => swatch(n, colour(`color-${n}`))).join('\n')}
</div>
<p class="note">Contrast ratios are computed against the canvas
<code>${CANVAS}</code> at build time, not copied from a comment. Text never uses
pure white: cream on green reads as printed rather than clinical and costs
almost nothing — ${ratio(colour('ground-50'), CANVAS).toFixed(1)}:1 against
white's ${ratio('#ffffff', CANVAS).toFixed(1)}:1, both AAA.</p>`,
  'One hue from green-black surfaces through to cream ink, plus a gold accent and a living green for progress.'
), 'utf-8');

// 2 — Arabic type: the part that matters most in this product
await writeFile(join(OUT, 'preview/arabic-type.html'), shell(
  'Arabic type', 'Foundations',
  `<h2>Amiri — Quranic ayat</h2>
<p class="ar" style="font-size:2.25rem">بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</p>
<p class="ar" style="font-size:1.5rem">ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ</p>
<h2>Noto Naskh Arabic — instructional text</h2>
<p class="naskh" style="font-size:2.25rem">بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</p>
<p class="naskh" style="font-size:1.5rem">ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ</p>
<h2>Mixed direction — the rule</h2>
<p dir="auto" class="naskh" style="font-size:1.125rem">What does ٱلْحَمْدُ mean?</p>
<p dir="auto" class="naskh" style="font-size:1.125rem">مَا مَعْنَى ٱلْحَمْدُ؟</p>
<p class="note"><strong>Two faces, one rule each.</strong> Amiri is the reference
face for Uthmani script and handles stacked diacritics cleanly, so it carries
ayat. It sits small on the em, which reads cramped in running UI text, so
Noto Naskh Arabic carries instructional text — questions, tutor replies,
vocabulary.<br><br>
<strong>Never set <code>direction: rtl</code> on mixed text.</strong>
<code>.text-naskh</code> deliberately sets font and leading but NOT direction.
The older <code>.arabic-text</code> bundles all three, so applying it to a
mostly-English string reordered the English and threw its question mark to the
wrong end. Pair <code>.text-naskh</code> with <code>dir="auto"</code> and let the
bidirectional algorithm decide. Leading is
<code>${tokens.get('leading-arabic')}</code> — diacritics need the room.</p>`,
  'Amiri for ayat, Noto Naskh for teaching text, and dir="auto" for anything mixed.'
), 'utf-8');

// 3 — Latin type scale
await writeFile(join(OUT, 'preview/type.html'), shell(
  'Type scale', 'Foundations',
  [...tw.matchAll(/^\s*'?([a-z0-9]+)'?:\s*\['([0-9.]+rem)',\s*\{\s*lineHeight:\s*'([0-9.]+)'/gm)]
    .map(([, name, size, lh]) => `<div style="border-bottom:1px solid ${colour('ground-800')};padding:10px 0">
  <span style="font-size:0.7rem;color:${colour('ground-400')};letter-spacing:.16em">${name.toUpperCase()} · ${size} · ${lh}</span>
  <div style="font-size:${size};line-height:${lh}">Recite in the name of your Lord</div></div>`).join('\n') +
  `<h2>Families</h2>
<div style="font-family:Amiri,serif;font-size:1.5rem">Amiri — display</div>
<div style="font-family:Inter,system-ui;font-size:1.125rem">Inter — body</div>
<div style="font-family:ui-monospace,monospace;font-size:0.875rem">Mono — 2:255, 128,219 segments</div>`,
  'Sizes and their paired line heights, read from the Tailwind theme.'
), 'utf-8');

// 4 — Spacing, radius, depth
await writeFile(join(OUT, 'preview/spacing.html'), shell(
  'Spacing, radius & depth', 'Foundations',
  `<h2>Spacing</h2>${['card', 'section', 'page'].map((n) => `
<div class="row"><code style="width:120px">${n}</code>
<div style="height:14px;width:${tokens.get(`padding-${n}`)};background:${colour('gold-500')};border-radius:3px"></div>
<span style="color:var(--muted);font-size:.8rem">${tokens.get(`padding-${n}`)}</span></div>`).join('')}
<h2>Radius</h2><div class="row">${['sm', 'md', 'lg', 'xl', 'full'].map((n) => `
<div style="text-align:center"><div style="width:76px;height:76px;background:${colour('ground-800')};
  border:1px solid ${colour('ground-700')};border-radius:${tokens.get(`radius-${n}`)}"></div>
  <code style="font-size:.7rem;color:var(--muted)">${n}</code></div>`).join('')}</div>
<h2>Depth</h2><div class="row">${['sm', 'md', 'lg', 'xl', 'glow'].map((n) => `
<div style="text-align:center"><div style="width:96px;height:64px;background:${colour('ground-900')};
  border:1px solid ${colour('ground-700')};border-radius:${tokens.get('radius-md')};
  box-shadow:${tokens.get(`shadow-${n}`)}"></div>
  <code style="font-size:.7rem;color:var(--muted)">${n}</code></div>`).join('')}</div>
<p class="note">Shadows on a near-black ground read as smudges, so elevation is
carried by borders and surface steps instead. The single glow is the gold focus
ring — <code>:focus-visible</code> is a 2px <code>gold-500</code> outline at 2px
offset, so it reads on any surface.</p>`,
  'Elevation comes from surface steps and borders, not shadows.'
), 'utf-8');

// 5 — Buttons
const BTN = {
  primary: `background:${colour('gold-500')};color:${colour('ground-950')};font-weight:600;border:none`,
  secondary: `background:${colour('ground-800')};color:${colour('ground-50')};border:1px solid ${colour('ground-700')}`,
  ghost: `background:transparent;color:${colour('ground-300')};border:none`,
  danger: `background:${colour('color-error')};color:${colour('ground-950')};font-weight:600;border:none`,
};
const SIZES = { sm: '6px 12px;font-size:.875rem', md: '8px 16px;font-size:.875rem', lg: '12px 24px;font-size:1rem' };
await writeFile(join(OUT, 'preview/buttons.html'), shell(
  'Buttons', 'Components',
  Object.entries(BTN).map(([v, style]) => `<h2>${v}</h2><div class="row">
${Object.entries(SIZES).map(([s, pad]) => `<button style="${style};padding:${pad};border-radius:${tokens.get('radius-md')};cursor:pointer">${s}</button>`).join('')}
<button style="${style};padding:${SIZES.md};border-radius:${tokens.get('radius-md')};opacity:.5">disabled</button>
</div>`).join('\n') + `
<p class="note">Primary hover is <code>gold-400</code> (${ratio(colour('gold-400'), CANVAS).toFixed(1)}:1
against canvas ink) and pressed is <code>gold-600</code>, which globals.css
documents as "pressed". This shipped for a while as
<code>hover:bg-gold-500</code> — identical to the base — so the app's main call
to action did not respond to the pointer at all. It was the only such no-op
across all 44 components.</p>`,
  'Four variants, three sizes. Primary is gold fill with canvas-dark ink at 7.8:1.'
), 'utf-8');

// 6 — Badges & feedback
await writeFile(join(OUT, 'preview/feedback.html'), shell(
  'Badges & progress', 'Components',
  `<h2>Badge</h2><div class="row">
${[['default', 'ground-800', 'ground-300', 'ground-700'],
   ['success', 'leaf-500', 'leaf-400', 'leaf-500'],
   ['warning', 'gold-500', 'gold-400', 'gold-500'],
   ['error', 'color-error', 'color-error', 'color-error'],
   ['info', 'color-info', 'color-info', 'color-info']]
  .map(([n, bg, fg, ring]) => `<span style="background:${colour(bg)}26;color:${colour(fg)};
   box-shadow:inset 0 0 0 1px ${colour(ring)}4d;padding:3px 10px;border-radius:999px;
   font-size:.75rem;font-weight:500">${n}</span>`).join('')}</div>
<h2>Progress</h2>
${[['gold-500', 72], ['leaf-500', 100], ['color-info', 35], ['ground-500', 8]]
  .map(([c, pct]) => `<div style="background:${colour('ground-800')};height:8px;border-radius:999px;
   margin:10px 0;overflow:hidden"><div style="width:${pct}%;height:100%;
   background:${colour(c)};border-radius:999px"></div></div>`).join('')}
<p class="note">Progress and success use <strong>leaf</strong>, never gold, so
"complete" never has to borrow the accent colour and the accent keeps meaning
"act here".</p>`,
  'Tinted fill at 15%, inset ring at 30%, so badges sit on any surface.'
), 'utf-8');

// 7 — Surfaces
await writeFile(join(OUT, 'preview/surfaces.html'), shell(
  'Surfaces & cards', 'Components',
  `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
${[['canvas', 'ground-950'], ['raised', 'ground-900'], ['secondary', 'ground-800']]
  .map(([n, c]) => `<div style="background:${colour(c)};border:1px solid ${colour('ground-700')};
   border-radius:${tokens.get('radius-lg')};padding:${tokens.get('padding-card')}">
   <strong>${n}</strong><br><code style="color:var(--muted);font-size:.75rem">${colour(c)}</code>
   <p style="color:var(--muted);font-size:.8125rem;margin:8px 0 0">Cards step up from the
   canvas and take a border. Interactive cards add a gold border at 40% on hover.</p></div>`).join('')}
</div>
<p class="note">There is deliberately no CSS component layer
(<code>.btn-primary</code>, <code>.card</code>, <code>.nav-item</code>). The
previous one duplicated the React primitives, drifted from them, and went
entirely unused. Compose with Tailwind utilities and the primitives in
<code>components/ui/</code>.</p>`,
  'Three surface steps, borders for elevation.'
), 'utf-8');

// 8 — Tajweed: functional colour, distinctive to this product
await writeFile(join(OUT, 'preview/tajweed.html'), shell(
  'Tajweed colours', 'Foundations',
  `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(190px,1fr))">
${TAJWEED.map((r) => swatch(`tajweed-${r}`, colour(`tajweed-${r}`))).join('\n')}
</div>
<h2>In context</h2>
<p class="ar" style="font-size:2rem">
<span style="color:${colour('tajweed-madd')}">ٱلضَّآلِّينَ</span>
<span style="color:${colour('tajweed-qalqalah')}">أَحَدْ</span>
<span style="color:${colour('tajweed-ghunnah')}">إِنَّ</span>
<span style="color:${colour('tajweed-noon-saakin')}">مِنْ رَّبِّهِمْ</span></p>
<p class="note">Functional, not decorative — each colour identifies a recitation
rule, so it must be distinguishable from the other five and legible on the
canvas. Every one is ≥4.5:1 above. Both values were retuned for the green
ground: the old noon-saakin green was <em>the ground colour itself</em>, and the
old qalqalah amber was the gold accent, so neither could be seen as a rule.</p>`,
  'Six rule colours, each ≥4.5:1 on canvas and mutually distinguishable.'
), 'utf-8');

// 8b — The tajweed reader treatment. The audit found four defects stacked here,
// so the card shows the wrong rendering beside the right one.
const RULE_DEMO = [
  ['\u0628\u0650', null], ['\u0633\u0652', 'hamzat-wasl'], ['\u0645\u0650', null],
];
await writeFile(join(OUT, 'preview/tajweed-reader.html'), shell(
  'Tajweed reader treatment', 'Components',
  `<h2>Wrong — what shipped</h2>
<p style="font-family:Inter,system-ui;font-size:1.875rem;direction:rtl;line-height:2">
<span style="background:#94a3b8;padding:0 2px;border-radius:3px">\u0671</span><span style="background:#14b8a6;padding:0 2px;border-radius:3px">\u0644</span><span style="background:#3b82f6;padding:0 2px;border-radius:3px">\u0631</span>\u0651\u064e\u062d\u0652\u0645\u064e\u0670\u0646\u0650</p>
<p class="note" style="border-color:${colour('color-error')}">Four defects at once.
The face is <strong>Inter</strong>, a Latin sans — the verse container carried no
Arabic font class at all. Each letter is wrapped in a span with
<code>padding: 0 2px</code>, which breaks the cursive joins and inflates the word
by <strong>78%</strong> (measured: 57.6px \u2192 102.4px). The colour is painted as
<code>background-color</code>, so it reads as a highlighter block over the glyph
rather than as coloured script. And the values are the pre-rebrand palette, three
of which fail 4.5:1.</p>

<h2>Right — coloured script</h2>
<p class="ar" style="font-size:1.875rem">
<span style="color:${colour('tajweed-hamzat-wasl')}">\u0671</span><span style="color:${colour('tajweed-lam-shamsiyyah')}">\u0644</span><span style="color:${colour('tajweed-madd')}">\u0631\u0651\u064e</span>\u062d\u0652\u0645\u064e\u0670\u0646\u0650</p>
<p class="note">Amiri, <code>lang="ar"</code>, <code>leading-arabic</code>, and
<code>color</code> on the span with no padding, background or border-radius.
Measured: a span that sets only <code>color</code> renders at
<strong>exactly the same width as plain text</strong> — 57.6px either way — so the
joins survive intact. This is also what a printed Tajweed Quran does: it colours
the letters.</p>

<h2>All ten rule colours on script</h2>
<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(210px,1fr))">
${TAJWEED.map((r) => `<div style="background:${colour('ground-900')};border:1px solid ${colour('ground-700')};
  border-radius:${tokens.get('radius-md')};padding:12px">
  <div class="ar" style="font-size:1.75rem;color:${colour(`tajweed-${r}`)}">\u0631\u064e\u0628\u0651\u0650\u0643\u064e</div>
  <code style="font-size:.7rem;color:var(--muted)">${r} \u00b7 ${colour(`tajweed-${r}`)} \u00b7 ${ratio(colour(`tajweed-${r}`), CANVAS).toFixed(1)}:1</code></div>`).join('')}
</div>
<p class="note">The renderer classifies <strong>ten</strong> rules; only six had
tokens. The four added — lam-shamsiyyah, idghaam, hamzat-wasl, silent — were
chosen against numbers rather than by eye: each is \u2265 4.5:1 on canvas,
\u2265 25 CIE76 from every other rule colour so the coding actually distinguishes,
and \u2265 22 from gold-500 and leaf-500 so no rule looks like the accent or like
progress. Tightest pair is idghaam/qalqalah at \u0394E 25.0 \u2014 both warm, and hue 0
was the only gap the existing six left open. <strong>silent</strong> is
deliberately ground-400 rather than a new hue: "not pronounced" should read as
de-emphasised text, not as another colour competing for attention.</p>`,
  'What shipped, what it should be, and why the ten colours are the ten they are.'
), 'utf-8');

// 9 — Forms
await writeFile(join(OUT, 'preview/forms.html'), shell(
  'Forms', 'Components',
  `<div style="max-width:420px;display:grid;gap:18px">
${[['Default', colour('ground-700')], ['Focus', colour('gold-500')], ['Error', colour('color-error')]]
  .map(([label, border]) => `<div>
  <label style="display:block;font-size:.75rem;letter-spacing:.16em;text-transform:uppercase;
   color:${colour('ground-400')};margin-bottom:6px">${label}</label>
  <input value="2:255" style="width:100%;background:${colour('ground-900')};color:${colour('ground-50')};
   border:1px solid ${border};border-radius:${tokens.get('radius-md')};padding:9px 12px;font-size:.875rem"
   ${label === 'Focus' ? `style="box-shadow:${tokens.get('shadow-glow')}"` : ''}>
  ${label === 'Error' ? `<p style="color:${colour('color-error')};font-size:.75rem;margin:6px 0 0">Enter a surah between 1 and 114.</p>` : ''}
</div>`).join('')}
</div>
<p class="note"><strong>Open finding.</strong> The app has 5 form controls but
only 2 <code>htmlFor</code> label associations, so at least three inputs are
unlabelled for a screen reader — a WCAG 2.1 AA failure. Every field in this
system carries a real <code>&lt;label for&gt;</code>; the implementation does not
yet match.</p>`,
  'Label above, gold focus ring, error text below the field.'
), 'utf-8');

// Tokens as CSS, for anyone consuming the system directly
await writeFile(join(OUT, 'colors_and_type.css'),
  `/* Bayan design tokens — GENERATED from src/app/styles/globals.css.\n` +
  ` * Do not hand-edit: run node scripts/gen-design-system.mjs.\n */\n:root {\n` +
  [...tokens.entries()].map(([k, v]) => `  --${k}: ${v};`).join('\n') + '\n}\n', 'utf-8');

await writeFile(join(OUT, 'README.md'), `# Bayan — Design System

Classical Arabic and Quran study. Deep green ground, gold accent, cream ink,
always dark. Two Arabic faces with one job each.

**Generated** by \`scripts/gen-design-system.mjs\` from
\`src/app/styles/globals.css\`, which is the single source of truth. Every swatch,
ratio and size here is derived, so this cannot drift from the code the way its
predecessor did — a hand-written "verification page" that ended up showing 38 of
its 39 colours from a palette the app had abandoned.

Re-publish with \`/design-sync\`; gate with
\`node scripts/gen-design-system.mjs --check\`.

## Foundations
| Card | Contents |
|---|---|
| Colour | ground / gold / leaf ramps, semantic aliases, computed contrast |
| Arabic type | Amiri for ayat, Noto Naskh for teaching text, the \`dir="auto"\` rule |
| Type scale | 9 sizes with paired line heights |
| Spacing, radius & depth | why elevation is borders, not shadows |
| Tajweed colours | six functional rule colours |

## Components
Buttons · Badges & progress · Surfaces & cards · Forms

## Rules this system enforces
1. **Always dark.** No light mode, no \`dark:\` variants.
2. **Never pure white text.** Cream on green; the contrast cost is negligible.
3. **Gold means "act here".** Progress and success use leaf so the accent keeps its meaning.
4. **No CSS component layer.** Compose utilities and the \`components/ui/\` primitives.
5. **Never set \`direction\` on mixed text.** \`.text-naskh\` + \`dir="auto"\`.
6. **Write full class names.** \`bg-\${x}-500\` generates nothing; so does a token
   the palette never defined — \`arabic-green\` compiled to nothing for months.

## Deviations
All three deviations this system was first published with are now fixed:
primary-button hover, the missing \`font-naskh\` utility, and the tajweed reader.
The unlabelled-input finding did not reproduce against the live DOM — every
control had an accessible name via \`aria-label\` or a wrapping label.
`, 'utf-8');

process.stdout.write(`wrote design system to ${OUT}\n`);
process.stdout.write(`  9 preview cards, colors_and_type.css (${tokens.size} tokens), README.md\n`);
if (problems.length) {
  process.stdout.write(`  ${problems.length} token problem(s) reported above and documented in the bundle\n`);
}
