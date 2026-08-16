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

import { readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
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

// ── Arabic without a declared language ─────────────────────────────────────
//
// `text-arabic` sets the face and the leading. It does not tell the browser or a
// screen reader that the text IS Arabic — `lang="ar"` does, and that drives font
// fallback for glyphs the face lacks, plus pronunciation if it is read aloud.
//
// Three elements in LearningPage.tsx carried `text-arabic dir="rtl"` with no lang,
// against the convention every other Arabic element follows. dir and lang are not
// the same claim: dir is layout, lang is identity.
{
  const offenders = [];
  const walk = async (dir) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      if (['node_modules', '.next', 'out'].includes(e.name)) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else if (e.name.endsWith('.tsx')) {
        const src = await readFile(full, 'utf-8');
        for (const m of src.matchAll(/<\w+\b[^>]*?>/gs)) {
          // The exact class token, so `text-arabic-green` does not match.
          if (!/className="[^"]*\btext-arabic\b(?![-\w])/.test(m[0])) continue;
          if (m[0].includes('lang="ar"')) continue;
          offenders.push(
            `${full.replace(root + '/', '')}:${src.slice(0, m.index).split('\n').length}`
          );
        }
      }
    }
  };
  await walk(join(root, 'src/app'));
  if (offenders.length > 0) {
    problems.push(
      `${offenders.length} element(s) use text-arabic without lang="ar": ` +
        offenders.join(', ')
    );
  }
}

// ── Arabic shaping: the tajweed renderers may style colour and nothing else ──
//
// Wrapping part of a word in a span with horizontal padding forces the shaping
// engine to break the cursive run: بِسْمِ went 57.6px to 102.4px, a 78% inflation,
// with letters rendering in isolated rather than connected forms. Measured in a
// browser, a span setting only `color` is byte-identical to plain text — the
// basmala across 13 spans came to 207.5px either way.
//
// segmentVerse's round-trip is already unit-tested, so the characters are safe. This
// guards the presentation, which is where the defect actually shipped: any padding,
// margin, background, border or inline-block on a segment span silently un-joins the
// script, and nothing else in the pipeline would notice.
const SEGMENT_RENDERERS = [
  'src/app/components/read/AyahReader.tsx',
  'src/app/components/tajweed/TajweedViewer.tsx',
];
const SHAPE_BREAKERS = /\b(padding|margin|background|backgroundColor|border|borderRadius|display)\s*:/;
for (const rel of SEGMENT_RENDERERS) {
  let src;
  try {
    src = await readFile(join(root, rel), 'utf-8');
  } catch {
    problems.push(`${rel} is missing — it renders tajweed segments and must be checked`);
    continue;
  }
  // The style object applied to a coloured segment span, wherever it appears.
  for (const m of src.matchAll(/seg\.color\s*\?[\s\S]{0,400}?<span[^>]*style=\{\{([^}]*)\}\}/g)) {
    const style = m[1];
    if (SHAPE_BREAKERS.test(style)) {
      problems.push(
        `${rel}: a tajweed segment span sets ${style.trim().slice(0, 60)} — anything ` +
          'beyond `color` breaks Arabic cursive joining. Colour the text, never box it.'
      );
    }
  }
}

// ── Arabic roots must read as words, not isolated letters ────────────────────
//
// `rootToArabic` joined the letters with a space, on the stated grounds that roots
// are "conventionally written" that way — and the same fifteen lines had been
// copy-pasted into three components, so every root in the app rendered as standalone
// glyphs (ق و ل) rather than a connected word (قول). Arabic is cursive: a space is a
// word boundary, and the shaping engine correctly isolates the letters on both sides
// of it. They were never going to join.
//
// Genuine LISTS of letters are a different thing and stay spaced — the fourteen sun
// letters, the fourteen moon letters, the five qalqalah letters. So this checks the
// fields that name a single root, not every spaced Arabic string.
const rootFields = [];
{
  const vocab = JSON.parse(await readFile(join(root, 'content/vocabulary/core-100.json'), 'utf-8'));
  for (const [i, e] of vocab.entries()) {
    if (typeof e.root === 'string') rootFields.push([`core-100[${i}].root`, e.root]);
  }
  const lessons = JSON.parse(await readFile(join(root, 'content/grammar/lessons.json'), 'utf-8'));
  const walk = (node, path) => {
    if (Array.isArray(node)) node.forEach((v, i) => walk(v, `${path}[${i}]`));
    else if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (k === 'letters') continue; // a list of letters, correctly spaced
        if (k === 'root' && typeof v === 'string') rootFields.push([`${path}.root`, v]);
        else walk(v, `${path}.${k}`);
      }
    }
  };
  lessons.forEach((l) => walk(l, l.id));
}
const SPACED_LETTERS = /^[\u0600-\u06FF](?: [\u0600-\u06FF])+$/;
for (const [where, value] of rootFields) {
  if (SPACED_LETTERS.test(value.trim())) {
    problems.push(
      `${where} is "${value}" — a root written as spaced letters renders every one in ` +
        'its isolated form. Join them and let Arabic shape the word.'
    );
  }
}
// And the helper itself, in both copies.
for (const rel of ['workers/src/lib/buckwalter.ts', 'src/app/lib/arabic-root.ts']) {
  const src = await readFile(join(root, rel), 'utf-8');
  if (/rootToArabic[\s\S]{0,400}?\.join\('\s'\)/.test(src)) {
    problems.push(`${rel}: rootToArabic joins the letters with a space, which prevents them shaping`);
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

// ── Flows ──────────────────────────────────────────────────────────────────
// Not tokens or components: the shape of the experience. Added because the entry
// point sends a fully-onboarded learner back to the 15-minute placement test
// every single time.

const box = (title, body, tone = 'ground-800') =>
  `<div style="background:${colour(tone)};border:1px solid ${colour('ground-700')};
   border-radius:${tokens.get('radius-md')};padding:14px 16px">
   <strong style="font-size:.9rem">${title}</strong>
   <div style="color:var(--muted);font-size:.8125rem;margin-top:4px">${body}</div></div>`;
const arrow = `<div style="text-align:center;color:${colour('ground-600')};font-size:1.1rem;margin:6px 0">↓</div>`;

await writeFile(join(OUT, 'preview/flow-entry.html'), shell(
  'Entry routing', 'Flows',
  `<h2>What happens now</h2>
<div style="max-width:520px">
${box('/ — goal picker', 'Four goal cards, stored in localStorage. Static client page.', 'ground-900')}
${arrow}
${box('Only CTA: “Continue to assessment”', '<code>href="/assessment"</code>, hard-coded. 15 minutes, 18 questions across 4 modules.', 'ground-900')}
</div>
<p class="note" style="border-color:${colour('color-error')}"><strong>It never asks
whether you have already done this.</strong> The assessment writes
<code>onboarding_completed = 1</code> and <code>current_path</code> to the users
table on submit. Nothing at the entry point reads either. So a learner who
finished the placement test — recorded, with a stored path — lands back on the
goal picker, and the only way forward is the 15-minute test again.<br><br>
There are also <strong>two separate onboarding flows</strong> that do not know
about each other: this one, and an <code>&lt;Onboarding/&gt;</code> component
<em>inside</em> <code>/dashboard</code> that asks different questions (reading
ability, memorized surahs, biggest challenge) and POSTs to
<code>/api/auth/onboarding</code>. Both set <code>onboarding_completed = 1</code>.
Neither is canonical.</p>

<h2>What it should do</h2>
<div style="max-width:520px">
${box('/ — decide, do not pitch', 'Read the profile once. Route. Render nothing else.', 'ground-900')}
${arrow}
<div class="grid" style="grid-template-columns:1fr 1fr;gap:12px">
${box('New → onboarding', 'Goal, then a real choice: place me (15 min) <em>or</em> start me at a level I pick. Skippable, resumable later.')}
${box('Returning → /today', 'Reviews due, next lesson, practice at your level. Never the goal picker again.')}
</div>
</div>
<p class="note">One flow, not two. The assessment becomes an <em>option</em> rather
than a gate — a 15-minute wall before any content is the classic
onboarding-abandonment shape, and everything behind it works fine without a
placement score: exercises are filterable by level, lessons have their own
prerequisite chain, memorization starts wherever you point it.</p>`,
  'Why a returning learner keeps landing on the placement test, and what the root route should do instead.'
), 'utf-8');

await writeFile(join(OUT, 'preview/flow-today.html'), shell(
  'Today — the resumed home', 'Flows',
  `<div style="max-width:560px">
  <div style="display:flex;justify-content:space-between;align-items:baseline">
    <div><div style="font-family:Amiri,serif;font-size:1.6rem">Today</div>
    <div style="color:var(--muted);font-size:.8125rem">Understand Classical Arabic · Level 3</div></div>
    <span style="background:${colour('gold-500')}1a;color:${colour('gold-400')};padding:4px 12px;
     border-radius:999px;font-size:.8rem">4 day streak</span>
  </div>

  <div style="background:${colour('ground-900')};border:1px solid ${colour('gold-500')}66;
   border-radius:${tokens.get('radius-lg')};padding:20px;margin-top:20px">
    <div style="font-size:.7rem;letter-spacing:.16em;color:${colour('gold-400')}">NEXT</div>
    <div style="font-size:1.15rem;font-weight:600;margin-top:6px">6 ayahs due for review</div>
    <div style="color:var(--muted);font-size:.8125rem;margin-top:4px">
      Al-Fatihah 1–4, An-Nas 1–2 · about 7 minutes</div>
    <div style="background:${colour('gold-500')};color:${colour('ground-950')};font-weight:600;
     text-align:center;padding:11px;border-radius:${tokens.get('radius-md')};margin-top:16px">Start review</div>
  </div>

  <h2>Then</h2>
  <div class="grid" style="gap:10px">
${box('Lesson 6 — The Idafa Construction', 'Level 2 · 20 min · unlocked by Case Endings')}
${/* Phrased as "N-item bank" on purpose: that is the shape gen-content-manifest.mjs
     matches, so this number now fails the build when it drifts. It said 4,950 through
     eight regenerations of the bank because "drawn from 4,950" matched no pattern. */ ''}
${box('20 grammar exercises at level 3', 'Verb form, case ending, word meaning · from a 41,709-item bank')}
${box('Add an ayah to memorize', 'Curriculum suggests An-Nas 3 next · 908 ordered units')}
  </div>
</div>
<p class="note"><strong>Every number on this screen already has an endpoint.</strong>
<code>GET /api/memorization/review/today</code> for what is due,
<code>/api/learning/next</code> for the next unlocked lesson,
the exercise bank filters
by level and kind. The assessment supplies the level and path. The machinery for
“here is your next thing” is complete and the entry point uses none of it —
it shows a goal picker instead.<br><br>
One primary action, chosen by what is actually due rather than by a grid of eight
equal tiles. Anti-slop tell 3 and 11 are both feature-tile grids; a dashboard of
equal cards is how you avoid deciding what matters.</p>`,
  'One screen, one primary action, every value drawn from an endpoint that already exists.'
), 'utf-8');

await writeFile(join(OUT, 'preview/flow-nav.html'), shell(
  'Navigation', 'Flows',
  `<h2>Now — eight items, no hierarchy</h2>
<div class="row" style="gap:8px">
${['Dashboard','Learn','Memorize','Tajweed','Grammar','Tutor','Progress','Advanced']
  .map((n) => `<span style="background:${colour('ground-800')};border:1px solid ${colour('ground-700')};
   padding:6px 12px;border-radius:${tokens.get('radius-md')};font-size:.8125rem">${n}</span>`).join('')}
</div>
<p class="note" style="border-color:${colour('color-error')}">Dashboard and Progress
both answer “how am I doing”. “Advanced” names a drawer rather than a subject, so
nothing in it is findable. Four of the eight — Learn, Memorize, Tajweed, Grammar —
are the actual activities, and they carry the same visual weight as the other four.</p>

<h2>Proposed — one home, four activities, one record</h2>
<div class="row" style="gap:8px">
${[['Today','gold-500'],['Read','ground-800'],['Memorize','ground-800'],['Grammar','ground-800'],['Look up','ground-800'],['Progress','ground-800']]
  .map(([n,c]) => `<span style="background:${c==='gold-500'?colour('gold-500'):colour('ground-800')};
   color:${c==='gold-500'?colour('ground-950'):colour('ground-50')};
   border:1px solid ${colour('ground-700')};padding:6px 12px;
   border-radius:${tokens.get('radius-md')};font-size:.8125rem;font-weight:${c==='gold-500'?600:400}">${n}</span>`).join('')}
</div>
<p class="note"><strong>Read</strong> absorbs Tajweed — the coloured reader IS how
you read here, so it is a view of the text rather than a separate subject.
<strong>Today</strong> replaces Dashboard as the home. <strong>Progress</strong>
keeps the record and the certificate. <strong>Advanced</strong> dissolves: its
tools move next to the activity they belong to, which is where someone would look
for them.<br><br>
Six items fit a phone without a scroll and leave the mobile menu meaningful. This
is a proposal about information architecture, not a token change — worth arguing
with before anyone builds it.</p>`,
  'Eight items with two overlaps and one grab-bag, versus six with distinct jobs.'
), 'utf-8');

// ── What the app should be ─────────────────────────────────────────────────
//
// Not tokens or components: a product thesis, argued from what the corpus makes
// computable. Every number in these cards was measured from the pinned text and
// the morphology corpus, not estimated.

const COVERAGE = [
  [25, 91], [50, 221], [100, 620], [150, 993],
  [250, 1867], [400, 3046], [600, 4222], [1000, 5462],
];
const AYAHS = 6236;
const TOP_ROOTS = [
  ['ٱللَّه', 'Alh', 2851, 5.7], ['قَوْل', 'qwl', 1722, 3.4], ['كَوْن', 'kwn', 1390, 2.8],
  ['رَبّ', 'rbb', 980, 2.0], ['أَمْن', 'Amn', 879, 1.8], ['عَلْم', 'Elm', 854, 1.7],
];


// ── 1. The thesis ──────────────────────────────────────────────────────────
await writeFile(join(OUT, 'preview/product-thesis.html'), shell(
  'What Bayan is', 'Product',
  `<p style="font-size:1.05rem;max-width:64ch;line-height:1.6">
Bayan is not a course you finish. It is <strong>one closed text, seen through
several lenses, widened a little every day</strong>.</p>

<h2>The advantage nobody is using</h2>
<p class="note" style="border-color:${colour('gold-500')}">Every language app works
against an open vocabulary: it can never tell you how much of the language you
know, because nobody knows how big the language is. <strong>This corpus is
closed.</strong> 6,236 ayahs, 77,429 words, 1,642 roots — all of it already
parsed, glossed and counted in this repository.<br><br>
So Bayan can make a promise no other app can, and have it be
<em>arithmetically true</em>.</p>

<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr));margin-top:20px">
${[[63, '50%', 'of every rooted word'], [249, '80%', 'of every rooted word'],
   [400, 'half', 'of all 6,236 ayahs, fully'], [600, '68%', 'of all ayahs, fully']]
  .map(([n, pct, label]) => `<div style="background:${colour('ground-900')};
   border:1px solid ${colour('gold-500')}4d;border-radius:${tokens.get('radius-lg')};padding:18px">
   <div style="font-size:2rem;font-weight:700;color:${colour('gold-400')};line-height:1">${n}</div>
   <div style="font-size:.75rem;letter-spacing:.14em;color:${colour('ground-400')};margin:6px 0">ROOTS UNLOCK</div>
   <div style="font-size:1.05rem;font-weight:600">${pct}</div>
   <div style="color:var(--muted);font-size:.8125rem">${label}</div></div>`).join('')}
</div>

<h2>The six commonest roots are 17% of the text</h2>
<div class="row" style="gap:10px">
${TOP_ROOTS.map(([ar, tr, n, pct]) => `<div style="background:${colour('ground-900')};
  border:1px solid ${colour('ground-700')};border-radius:${tokens.get('radius-md')};
  padding:10px 14px;text-align:center">
  <div class="ar" style="font-size:1.4rem">${ar}</div>
  <code style="font-size:.65rem;color:var(--muted)">${tr}</code>
  <div style="font-size:.8rem;color:${colour('gold-400')}">${pct}%</div></div>`).join('')}
</div>

<h2>What follows from that</h2>
<div class="grid" style="gap:10px;margin-top:8px">
${box('The unit of work is an ayah, not a lesson',
  'Eight modules are eight views of the same 6,236 verses. Reciting, reading, parsing and memorizing an ayah are one activity seen four ways, not four places to visit.')}
${box('Progress is coverage, not completion',
  '"Level 3, 4-day streak" says nothing. "You can now read 620 ayahs end to end" is true, checkable, and worth another ten minutes tomorrow.')}
${box('The curriculum orders itself',
  'Roots in frequency order. No syllabus to author, no opinion to defend — and the app can show you exactly which ayahs each new root just opened.')}
${box('The session ends on the text',
  'Reviews, then one new thing, then read a passage your new vocabulary just unlocked. Ending on scripture is the point. Ending on a quiz score is not.')}
</div>
<p class="note">Measured, not estimated: coverage from the pinned Tanzil Uthmani
text and the Quranic Arabic Corpus v0.4 in this repo. Words with no root — particles
and pronouns — count as known, since they are learned in the first week and are not
what gates comprehension.</p>`,
  'One closed text, already fully parsed. That makes an honest promise possible.'
), 'utf-8');

// ── 2. Coverage as the progress model ──────────────────────────────────────
const maxA = 5462;
await writeFile(join(OUT, 'preview/flow-coverage.html'), shell(
  'Coverage, not completion', 'Product',
  `<h2>Ayahs you can read end to end, as roots accumulate</h2>
<div style="max-width:560px">
${COVERAGE.map(([r, a]) => `<div style="display:flex;align-items:center;gap:12px;margin:7px 0">
  <code style="width:74px;text-align:right;color:var(--muted);font-size:.75rem">${r} roots</code>
  <div style="flex:1;background:${colour('ground-800')};height:20px;border-radius:4px;overflow:hidden">
    <div style="width:${(a / maxA * 100).toFixed(1)}%;height:100%;
     background:${r >= 400 ? colour('gold-500') : colour('leaf-500')}"></div></div>
  <span style="width:112px;font-size:.8rem">${a.toLocaleString()} <span style="color:var(--muted)">(${(a / AYAHS * 100).toFixed(0)}%)</span></span>
</div>`).join('')}
</div>
<p class="note"><strong>400 roots is the headline.</strong> It is half the Quran,
fully readable — every word in 3,046 ayahs. At ten new roots a week that is under a
year, and the app can say so honestly because it has counted.</p>

<h2>What the progress screen should show</h2>
<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
${[['Ayahs fully readable', '620', 'of 6,236 · 9.9%', 'gold-400'],
   ['Roots known', '100', 'of 1,642 · covers 60% of rooted words', 'leaf-400'],
   ['Words recognised', '11,300', 'of 77,429 occurrences', 'leaf-400'],
   ['Whole surahs', '0', 'first at ~114 roots — Al-Kafirun', 'gold-400']]
  .map(([label, big, sub, c]) => `<div style="background:${colour('ground-900')};
   border:1px solid ${colour('ground-700')};border-radius:${tokens.get('radius-lg')};padding:16px">
   <div style="font-size:.72rem;letter-spacing:.14em;color:${colour('ground-400')}">${label.toUpperCase()}</div>
   <div style="font-size:1.9rem;font-weight:700;color:${colour(c)};line-height:1.15">${big}</div>
   <div style="color:var(--muted);font-size:.78rem">${sub}</div></div>`).join('')}
</div>
<p class="note" style="border-color:${colour('color-error')}"><strong>Correction.</strong>
An earlier version of this card claimed "31 surahs · mostly Juz 30". That number was
invented and it is wrong. Measured: the first surah to become fully readable is
Al-Kafirun at the 114 commonest roots, the second does not arrive until roughly 417,
and 1,000 roots yields only 10. Whole surahs need every rare word in them, so the
metric sits at 0 or 1 for a long time — demotivating, and the opposite of the intent.
<strong>Ayahs are the metric that moves</strong>; whole surahs are kept as a
milestone with the distance stated.</p>
<p class="note">Every one of these is a query away from data already in D1 —
<code>quran_word_morphology</code> has the roots, <code>quran_word_gloss</code> the
words, and a per-user "known roots" table is the only thing missing. It is one
table and one join, and it replaces four vanity metrics with four true ones.<br><br>
<strong>Streaks stay, but demoted.</strong> A streak measures showing up; coverage
measures learning. Only one of those is why someone opened the app.</p>`,
  'A progress model made of true statements about a finite text.'
), 'utf-8');

// ── 3. The ayah as the unit of work ────────────────────────────────────────
await writeFile(join(OUT, 'preview/flow-ayah.html'), shell(
  'The ayah is the unit', 'Product',
  `<div style="max-width:600px;background:${colour('ground-900')};
 border:1px solid ${colour('ground-700')};border-radius:${tokens.get('radius-lg')};padding:22px">
  <div style="display:flex;justify-content:space-between;color:var(--muted);font-size:.78rem">
    <span>Al-Fatihah 1:2</span><span>every word known · 4 roots</span></div>

  <div class="ar" style="font-size:2.1rem;text-align:center;margin:18px 0">
    <span style="color:${colour('tajweed-hamzat-wasl')}">ٱ</span>لْحَمْدُ
    لِلَّهِ رَبِّ <span style="color:${colour('tajweed-madd')}">ٱ</span>لْعَـٰلَمِينَ</div>

  <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;direction:rtl">
${[['ٱلْحَمْدُ', 'All praise', 'Hmd'], ['لِلَّهِ', 'to Allah', 'Alh'],
   ['رَبِّ', 'Lord of', 'rbb'], ['ٱلْعَـٰلَمِينَ', 'the worlds', 'Elm']]
  .map(([ar, en, rt]) => `<div style="background:${colour('ground-800')};
   border:1px solid ${colour('ground-700')};border-radius:${tokens.get('radius-sm')};
   padding:7px 10px;text-align:center;min-width:88px">
   <div class="ar" style="font-size:1.1rem">${ar}</div>
   <div style="font-size:.7rem;color:var(--muted)">${en}</div>
   <code style="font-size:.62rem;color:${colour('gold-400')}">${rt}</code></div>`).join('')}
  </div>

  <div class="row" style="gap:6px;margin-top:20px;justify-content:center">
${[['Recite', 'gold-500'], ['Meaning', 'ground-800'], ['Parse', 'ground-800'],
   ['Memorize', 'ground-800'], ['Ask', 'ground-800']]
  .map(([n, c]) => `<span style="background:${colour(c)};
   color:${c === 'gold-500' ? colour('ground-950') : colour('ground-300')};
   border:1px solid ${colour('ground-700')};padding:7px 14px;
   border-radius:${tokens.get('radius-md')};font-size:.8rem">${n}</span>`).join('')}
  </div>
</div>

<h2>Five lenses, one screen</h2>
<div class="grid" style="gap:10px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
${box('Recite', 'Tajweed colours on the script. Ten rules, all ≥4.5:1. Audio per ayah.')}
${box('Meaning', 'Word-by-word glosses, 77,429 of them, plus a full translation.')}
${box('Parse', 'The corpus record: root, lemma, part of speech, form, case. 128,219 segments.')}
${box('Memorize', 'Add this ayah to the SM-2 schedule from where you are reading it.')}
${box('Ask', 'The tutor, scoped to THIS ayah — not a free-floating chat tab.')}
</div>
<p class="note">All five already exist as separate pages, each with its own surah
picker, each making you navigate to it and find your place again. They are lenses
on one object. <strong>Making the ayah the unit removes four surah pickers and
three navigations.</strong><br><br>
The header line matters most: <em>"every word known · 4 roots"</em>. That is the
app telling you this ayah is inside your reach — which is the whole motivational
loop, and it is one join away from data already stored.</p>`,
  'Reciting, reading, parsing and memorizing are one activity seen five ways.'
), 'utf-8');

// ── 4. The daily session ───────────────────────────────────────────────────
await writeFile(join(OUT, 'preview/flow-session.html'), shell(
  'The daily session', 'Product',
  `<div style="max-width:520px">
${box('1 · Due reviews', 'Whatever SM-2 says is due — memorized ayahs, and roots you met before. Usually 4–8 minutes. Skippable when nothing is due, never invented to fill the slot.', 'ground-900')}
${arrow}
${box('2 · One new root', 'The next in frequency order. Shown with its family — the forms it actually takes in the text — and the ayahs it just opened.', 'ground-900')}
${arrow}
${box('3 · Read what it unlocked', 'A short passage that is now fully within reach. This is the payoff and it must be last.', 'ground-900')}
</div>
<p class="note"><strong>Twelve minutes, and it ends on scripture.</strong> The order
is the design: a session that ends on a quiz score tells you how you did, and a
session that ends on reading the text you came for tells you why you bothered.
<br><br>
Step 2 is where the closed corpus earns its keep — "this root appears 980 times and
opens 41 more ayahs for you" is a true sentence the app can compute, and it is far
more motivating than "Lesson 6 of 10".</p>

<h2>What this replaces</h2>
<div class="grid" style="gap:10px;grid-template-columns:1fr 1fr">
${box('Now', 'Land on a goal picker. Choose a goal you already chose. A 15-minute placement test you already passed. Then eight tabs and no suggestion of where to start.', 'ground-900')}
${box('Proposed', 'Land on today. One primary action, already chosen for you. Two secondary. The text at the end.', 'ground-900')}
</div>`,
  'Reviews, one new root, then read what it unlocked. In that order.'
), 'utf-8');

// ── Build specs ────────────────────────────────────────────────────────────
// The two pieces the thesis needs and the app does not have: an ayah that is one
// object rather than five pages, and a loop that records a root as known so
// coverage actually moves.

const KNOWN = colour('ground-50');
const UNKNOWN = colour('gold-400');

const wordChip = (ar, en, root, known) =>
  `<div style="text-align:center;min-width:92px">
     <div class="ar" style="font-size:1.35rem;color:${known ? KNOWN : UNKNOWN};
      ${known ? '' : `border-bottom:1px dotted ${colour('gold-500')};padding-bottom:2px;`}">${ar}</div>
     <div style="font-size:.7rem;color:var(--muted);margin-top:3px">${en}</div>
     <code style="font-size:.62rem;color:${known ? colour('ground-500') : colour('gold-400')}">${root}</code>
   </div>`;

await writeFile(join(OUT, 'preview/spec-ayah-screen.html'), shell(
  'Spec — the ayah screen', 'Product',
  `<p style="max-width:66ch">One route, <code>/read?s=1&a=2</code>, and one API call.
Query parameters rather than a dynamic segment because the app is a static export —
6,236 pre-rendered ayah pages is the wrong trade.</p>

<h2>The screen</h2>
<div style="max-width:620px;background:${colour('ground-900')};
 border:1px solid ${colour('ground-700')};border-radius:${tokens.get('radius-lg')};padding:22px">
  <div style="display:flex;justify-content:space-between;color:var(--muted);font-size:.78rem">
    <span>Al-Fatihah · 1:2</span><span style="color:${colour('leaf-400')}">every word known</span></div>

  <div class="ar" style="font-size:2.1rem;text-align:center;margin:16px 0">
    ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ</div>

  <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;direction:rtl">
${wordChip('ٱلْحَمْدُ', 'All praises', 'Hmd', true)}
${wordChip('لِلَّهِ', '(be) to Allah', 'Alh', true)}
${wordChip('رَبِّ', 'the Lord', 'rbb', true)}
${wordChip('ٱلْعَـٰلَمِينَ', 'of the universe', 'Elm', true)}
  </div>

  <div class="row" style="gap:6px;margin-top:22px;justify-content:center">
${['Recite', 'Meaning', 'Parse', 'Memorize', 'Ask'].map((n, i) =>
  `<span style="background:${i === 1 ? colour('gold-500') : colour('ground-800')};
   color:${i === 1 ? colour('ground-950') : colour('ground-300')};
   border:1px solid ${colour('ground-700')};padding:10px 16px;min-height:44px;
   display:inline-flex;align-items:center;
   border-radius:${tokens.get('radius-md')};font-size:.8rem">${n}</span>`).join('')}
  </div>
</div>

<h2>A word you do not know yet</h2>
<div style="max-width:620px;background:${colour('ground-900')};
 border:1px solid ${colour('ground-700')};border-radius:${tokens.get('radius-lg')};padding:18px">
  <div style="display:flex;justify-content:space-between;color:var(--muted);font-size:.78rem">
    <span>Al-Baqarah · 2:2</span><span style="color:${colour('gold-400')}">2 words to learn</span></div>
  <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;direction:rtl;margin-top:14px">
${wordChip('ذَٰلِكَ', 'That', '—', true)}
${wordChip('ٱلْكِتَـٰبُ', 'the Book', 'ktb', true)}
${wordChip('لَا', '(is) no', '—', true)}
${wordChip('رَيْبَ', 'doubt', 'ryb', false)}
${wordChip('فِيهِ', 'in it', '—', true)}
${wordChip('هُدًى', 'a guidance', 'hdy', false)}
  </div>
</div>
<p class="note">The dotted underline and gold are the coverage model made visible at
word level. <strong>This is the whole motivational loop in one glance</strong> —
"2 words to learn" is a specific, finishable task, and tapping one offers to learn
its root. Every other progress bar in the app is a number; this is the number
pointing at the thing to do next.</p>

<h2>The five lenses, and where each gets its data</h2>
<div class="grid" style="gap:10px">
${box('Recite', 'Tajweed colours on the script, ten rules, plus per-ayah audio. <code>GET /api/tajweed/verses/:surah</code> — already exists.')}
${box('Meaning', 'Word-by-word glosses. <code>quran_word_gloss</code>, 77,429 rows. Note there is NO full-translation table, so "meaning" is the gloss chain — worth saying rather than implying a translation exists.')}
${box('Parse', 'Root, lemma, part of speech, form, case, voice, per segment. <code>GET /api/quran/ayah/:surah/:ayah</code> returns it inline, and returns null where the corpus is silent so the UI can say "not annotated".')}
${box('Memorize', 'Add this ayah to the SM-2 schedule from where you are reading. <code>POST /api/memorization/add</code> — already exists.')}
${box('Ask', 'The tutor, pre-scoped to this location. <code>POST /api/tutor/chat</code> — already exists and already classifies "2:255" as a location intent.')}
</div>
<p class="note"><strong>One new endpoint, not five.</strong> All of the above exists,
but a screen assembling it would make four calls and do a join in the browser. So
<code>GET /api/quran/ayah/:surah/:ayah</code> returns the text, the words with gloss
+ morphology + a known-root flag, and the tajweed tags — one object, which is the
point of the whole design.</p>`,
  'One route, one API call, five lenses. Unknown words marked so coverage is visible where you read.'
), 'utf-8');

await writeFile(join(OUT, 'preview/spec-root-loop.html'), shell(
  'Spec — the root loop', 'Product',
  `<p style="max-width:66ch">Coverage cannot move until something records a root as
known. The table and the endpoint exist; nothing writes to them. This closes it.</p>

<div style="max-width:560px;background:${colour('ground-900')};
 border:1px solid ${colour('gold-500')}66;border-radius:${tokens.get('radius-lg')};padding:22px">
  <div style="font-size:.7rem;letter-spacing:.16em;color:${colour('gold-400')}">NEW ROOT</div>
  <div class="ar" style="font-size:2.6rem;text-align:center;color:${colour('gold-400')};margin:10px 0">ق و ل</div>
  <p style="text-align:center;color:var(--muted);font-size:.82rem;margin:0">
    1,722 occurrences · the 2nd commonest root in the Quran</p>

  <h2 style="margin-top:22px">Forms the corpus attests</h2>
  <div class="row" style="gap:8px">
${[['قَالَ', 'I · perfect'], ['يَقُولُ', 'I · imperfect'], ['قُلْ', 'I · imperative'], ['قَوْل', 'noun']]
  .map(([ar, tag]) => `<div style="background:${colour('ground-800')};border:1px solid ${colour('ground-700')};
   border-radius:${tokens.get('radius-sm')};padding:8px 12px;text-align:center">
   <div class="ar" style="font-size:1.2rem">${ar}</div>
   <code style="font-size:.62rem;color:var(--muted)">${tag}</code></div>`).join('')}
  </div>

  <h2 style="margin-top:20px">Where you will meet it</h2>
  <p class="ar" style="font-size:1.3rem;margin:6px 0">وَإِذْ <span style="color:${colour('gold-400')}">قَالَ</span> رَبُّكَ لِلْمَلَـٰئِكَةِ</p>
  <p style="color:var(--muted);font-size:.75rem;margin:0">2:30</p>

  <div style="background:${colour('gold-500')};color:${colour('ground-950')};font-weight:600;
   text-align:center;padding:12px;border-radius:${tokens.get('radius-md')};margin-top:20px;min-height:44px">
   I know this root</div>
</div>

<h2>The payoff, immediately after</h2>
<div style="max-width:560px;background:${colour('leaf-500')}1a;
 border:1px solid ${colour('leaf-500')}66;border-radius:${tokens.get('radius-lg')};padding:20px;margin-top:14px">
  <div style="font-size:1.3rem;font-weight:600;color:${colour('leaf-400')}">
    +37 ayahs now fully readable</div>
  <p style="color:var(--muted);font-size:.84rem;margin:6px 0 0">
    657 of 6,236 · 101 roots known. Next: <span class="ar">ك و ن</span>, 1,390 occurrences.</p>
</div>
<p class="note"><strong>This screen is the reason the coverage model is worth
having.</strong> "+37 ayahs" is a specific, true, immediate consequence of one
decision — and it is computable, because the corpus is closed. Nothing else in the
app can say that, and no app working against an open vocabulary could.<br><br>
One new endpoint: <code>POST /api/progress/roots/:root/known</code>, which records
the root and returns the coverage delta so the payoff is a fact rather than an
animation. Reversible — the same route deletes on DELETE, because "I marked that
too early" is the obvious next thing a learner needs.</p>

<h2>Where the loop runs</h2>
<div class="grid" style="gap:10px;grid-template-columns:1fr 1fr">
${box('From Today', 'When nothing is due, the primary action is "learn one new root" — the commonest one not yet known. Frequency order IS the curriculum.')}
${box('From a word you are reading', 'Tap a gold-underlined word in the ayah screen and it offers that word’s root. Learning driven by what you actually hit.')}
</div>`,
  'Record a root as known, and say immediately what it opened.'
), 'utf-8');

// ── Root calibration ───────────────────────────────────────────────────────
await writeFile(join(OUT, 'preview/spec-calibration.html'), shell(
  'Spec — root calibration', 'Product',
  `<p class="note" style="border-color:${colour('color-error')}"><strong>What this is
NOT.</strong> The obvious move was to seed known roots from the placement test
score: level 3 implies the top 120 roots, and so on. That would be fabrication.
The assessment has eighteen questions across literacy, comprehension, grammar and
memorization, and <strong>not one of them tests which roots you know</strong>.
Inferring a root list from a comprehension score is the same failure as the tutor
citing Arabic it had never checked — a confident number with nothing behind it.</p>

<h2>Measure instead. Twelve questions, about a minute.</h2>
<div style="max-width:520px;background:${colour('ground-900')};
 border:1px solid ${colour('ground-700')};border-radius:${tokens.get('radius-lg')};padding:22px">
  <div style="display:flex;justify-content:space-between;color:var(--muted);font-size:.78rem">
    <span>4 of 12</span><span>rank 100 of 1,642</span></div>
  <div class="ar" style="font-size:2.4rem;text-align:center;color:${colour('gold-400')};margin:14px 0 6px">ع ل م</div>
  <p style="text-align:center;margin:0 0 4px"><span class="ar" style="font-size:1.4rem">يَعْلَمُ</span></p>
  <p style="text-align:center;color:var(--muted);font-size:.8rem;margin:0">“he knows” · 854 occurrences</p>
  <div class="row" style="gap:10px;margin-top:20px">
    <span style="flex:1;background:${colour('leaf-500')};color:${colour('ground-950')};
     text-align:center;padding:12px;border-radius:${tokens.get('radius-md')};
     font-weight:600;min-height:44px">I know this</span>
    <span style="flex:1;background:${colour('ground-800')};color:${colour('ground-50')};
     border:1px solid ${colour('ground-700')};text-align:center;padding:12px;
     border-radius:${tokens.get('radius-md')};min-height:44px">Not yet</span>
  </div>
</div>
<p class="note">Twelve roots sampled across the frequency ranking rather than the
first twelve — ranks 5, 15, 30, 60, 100, 160, 250, 380, 550, 800, 1100, 1500. Each
shows its commonest attested word and that word’s gloss, because a bare triliteral
is recognisable to almost nobody and the word is what you actually meet.</p>

<h2>Then the inference, made explicit and optional</h2>
<div style="max-width:520px;background:${colour('gold-500')}14;
 border:1px solid ${colour('gold-500')}66;border-radius:${tokens.get('radius-lg')};padding:20px">
  <p style="margin:0 0 6px;font-weight:600">You knew every root up to rank 100.</p>
  <p style="margin:0;color:var(--muted);font-size:.84rem">Mark the other 88 roots in
  that band as known too? Frequency ordering means knowledge is roughly monotonic in
  rank, so this is usually right — but it is an estimate, not a measurement, and you
  can correct any of them later.</p>
  <div class="row" style="gap:10px;margin-top:16px">
    <span style="background:${colour('gold-500')};color:${colour('ground-950')};padding:11px 18px;
     border-radius:${tokens.get('radius-md')};font-weight:600;min-height:44px">Yes, mark them</span>
    <span style="background:transparent;color:${colour('ground-300')};padding:11px 18px;
     border-radius:${tokens.get('radius-md')};min-height:44px">Only the 12 I answered</span>
  </div>
</div>
<p class="note"><strong>Measurement and inference are separated deliberately.</strong>
The twelve answers are recorded as fact. The bulk seed is a guess the learner
accepts or declines, with the assumption behind it stated in the sentence rather
than buried in a commit message. Every root remains individually reversible through
the same DELETE the root screen uses.<br><br>
Placement still has a job — literacy, comprehension, grammar and memorization
levels shape the lesson path. It just does not get to invent a vocabulary.</p>`,
  'Twelve sampled roots, a minute of work, and a bulk seed the learner opts into.'
), 'utf-8');

await writeFile(join(OUT, 'preview/spec-word-role-kinds.html'), shell(
  'Spec — four kinds from the remaining POS tags, not eight', 'Product',
  `<p style="max-width:66ch">Eight tagged classes had volume and no dedicated drill:
REL, PRON, ACC, T, DEM, COND, LOC, INTG. Reachable only through <code>pos_id</code>, which
asks the generic "what part of speech is this".</p>

<p class="note" style="border-color:${colour('color-error')}">The obvious build is eight
"which word is the X in this ayah" kinds. That would be padding: eight near-identical
questions, each answerable by elimination once you know the other seven words are not
particles. Volume is not the same as teaching.</p>

<h2>The question that discriminates</h2>
<p style="max-width:66ch">A learner meeting ٱلَّذِينَ needs to know it is a relative
pronoun — not that one exists somewhere nearby. So the main new kind gives the word and
asks its role, with the other roles as options:</p>

<div style="max-width:520px;background:${colour('ground-900')};
 border:1px solid ${colour('ground-800')};border-radius:${tokens.get('radius-lg')};padding:20px">
  <p style="margin:0 0 4px;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;
   color:var(--muted)">Word role · level 2</p>
  <p class="ar" style="font-size:2.2rem;text-align:center;margin:14px 0 4px">ٱلَّذِينَ</p>
  <p style="text-align:center;color:var(--muted);font-size:.78rem;margin:0 0 16px">2:6</p>
  ${[['Relative pronoun', true], ['Demonstrative', false], ['Conditional particle', false],
     ['Interrogative', false]].map(([o, ok]) => `
  <div style="border:1px solid ${ok ? colour('leaf-500') : colour('ground-800')};
   border-radius:${tokens.get('radius-md')};padding:9px 12px;margin-bottom:7px;font-size:.9rem">
    ${o}${ok ? ` <span style="float:right;color:${colour('leaf-400')};font-size:.72rem">✓</span>` : ''}
  </div>`).join('')}
  <p style="margin:12px 0 0;font-size:.75rem;color:var(--muted)">Eight roles in the pool,
  four shown: relative pronoun, demonstrative, conditional, interrogative, negation,
  accusative particle, time adverb, place adverb.</p>
</div>

<h2>Four kinds</h2>
<table style="border-collapse:collapse;font-size:.85rem;max-width:660px">
  <tr style="text-align:left;color:var(--muted)">
    <th style="padding:6px 14px 6px 0">Kind</th><th style="padding:6px 14px 6px 0">Pool</th>
    <th style="padding:6px 0">Why it earns its place</th></tr>
  ${[
    ['word_role', '~6,500', 'the discriminating question, across all eight classes'],
    ['relative_pronoun', '2,202', 'spotting الذي in a long ayah is its own skill'],
    ['demonstrative', '773', 'gives grammar-09 a sharper drill than pos_id'],
    ['conditional', '403', 'إن and لو change the mood of what follows'],
  ].map(([k, n, why]) => `<tr>
      <td style="padding:5px 14px 5px 0"><code>${k}</code></td>
      <td style="padding:5px 14px 5px 0;color:var(--muted)">${n}</td>
      <td style="padding:5px 0">${why}</td></tr>`).join('')}
</table>

<p class="note">PRON, ACC, T, LOC and INTG get no find-the-word kind of their own. They are
in <code>word_role</code>, which is where they teach something; a separate "which word is
the time adverb" would be the padding this spec exists to avoid.</p>

<h2>Rules these follow</h2>
<ul style="max-width:66ch">
  <li><strong>One find-in-ayah implementation, not four.</strong> The negation kind already
  does this — pick the tagged word, distractors from its neighbours, deduplicated on the
  RENDERED string because different Buckwalter renders identically. That logic moves into a
  helper the new kinds share, rather than being copied and drifting.</li>
  <li><strong>Whole words only, as everywhere else.</strong> That halves REL and cuts PRON
  from 3,301 to 840, because attached pronouns are suffixes rather than words — which is
  itself the reason PRON gets no find-the-word kind.</li>
  <li><strong>Distractors must be plausible.</strong> In word_role they are other real
  roles; in the find kinds they are other words from the same ayah. A distractor nobody
  could pick teaches nothing.</li>
</ul>`,
  'Eight tagged classes, four kinds. Volume is not the same as teaching.'
), 'utf-8');

await writeFile(join(OUT, 'preview/spec-new-exercise-kinds.html'), shell(
  'Spec — five exercise kinds from annotation already ingested', 'Product',
  `<p style="max-width:66ch">The exercise generator reads five fields out of the corpus.
The ingest captured far more, and roughly <strong>108,000 annotated facts</strong> have
been sitting in the database unused — enough for five new kinds covering grammar the app
has never drilled once.</p>

<p class="note" style="border-color:${colour('color-error')}">This also corrects a claim
I made twice: that the corpus does not annotate definiteness or negation, which is why
grammar-01 and grammar-10 were left with no practice link. It annotates both —
<code>DET</code> on 8,377 prefix segments and <code>POS:NEG</code> on 2,688. I had checked
the <code>pos</code> column and never looked at <code>tag</code>.</p>

<h2>What is there</h2>
<table style="border-collapse:collapse;font-size:.85rem;max-width:660px">
  <tr style="text-align:left;color:var(--muted)">
    <th style="padding:6px 14px 6px 0">Annotation</th><th style="padding:6px 14px 6px 0">Rows</th>
    <th style="padding:6px 0">Becomes</th></tr>
  ${[
    ['gender + person + number (3MS, 2MP…)', '49,007', 'subject agreement'],
    ['mood (IND / JUS / SUBJ)', '11,420', 'mood after particles'],
    ['INDEF, and the DET prefix', '8,672 + 8,377', 'definiteness'],
    ['PASS (active is unmarked)', '4,665', 'voice'],
    ['POS:NEG', '2,688', 'negation'],
  ].map(([a, n, b]) => `<tr>
      <td style="padding:5px 14px 5px 0">${a}</td>
      <td style="padding:5px 14px 5px 0;color:var(--muted)">${n}</td>
      <td style="padding:5px 0;color:${colour('leaf-400')}">${b}</td></tr>`).join('')}
</table>

<h2>The design decision: agreement, not gender trivia</h2>
<p class="note">Asking "what gender is this word" tests a label the learner can read off
the ending, and teaches nothing about reading. The corpus fuses person, gender and number
into one tag — <code>3MS</code>, <code>2MP</code>, <code>1P</code> — which supports a
better question: <strong>who is the subject of this verb?</strong> Decoding who did what
to whom is precisely what a reader needs, and the ending is the only thing that says so.</p>

<div style="max-width:520px;background:${colour('ground-900')};
 border:1px solid ${colour('ground-800')};border-radius:${tokens.get('radius-lg')};padding:20px">
  <p style="margin:0 0 4px;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;
   color:var(--muted)">Subject agreement · level 2</p>
  <p class="ar" style="font-size:2.2rem;text-align:center;margin:14px 0 4px">تُفْسِدُوا۟</p>
  <p style="text-align:center;color:var(--muted);font-size:.78rem;margin:0 0 16px">2:11</p>
  ${['he', 'you (m. pl.)', 'they (f.)', 'we'].map((o, i) => `
  <div style="border:1px solid ${i === 1 ? colour('leaf-500') : colour('ground-800')};
   border-radius:${tokens.get('radius-md')};padding:9px 12px;margin-bottom:7px;font-size:.9rem">
    ${o}${i === 1 ? ` <span style="float:right;color:${colour('leaf-400')};font-size:.72rem">✓</span>` : ''}
  </div>`).join('')}
  <p style="margin:12px 0 0;font-size:.75rem;color:var(--muted)">The corpus tags this
  2MP — second person, masculine, plural. Nothing but the ـُوا ending carries that.</p>
</div>

<h2>Rules these follow</h2>
<ul style="max-width:66ch">
  <li><strong>Definiteness is a word-level question, not a segment one.</strong> The
  article is its own DET prefix segment and INDEF sits on the stem, so the generator has
  to look at the whole word — every other kind here reads a single segment. Getting that
  wrong would ask "is ٱلْكِتَابُ definite" about the bare ال.</li>
  <li><strong>Active is unmarked.</strong> Only PASS appears, so voice questions must draw
  their active examples from verbs with no PASS rather than from a field that says ACT —
  and a missing field is not the same as an absent feature elsewhere in this data.</li>
  <li><strong>Negation asks which word negates, not whether the sentence is negative.</strong>
  The tag marks the particle; the sentence-level reading is not annotated and would be a
  guess dressed as a fact.</li>
  <li><strong>Mood only on imperfect verbs.</strong> JUS and SUBJ are governed by preceding
  particles, so the prompt shows enough of the ayah for the particle to be visible —
  otherwise the question is unanswerable and the learner is guessing.</li>
  <li><strong>Same level rule as the existing five kinds</strong> — difficulty from form
  frequency, so "level 3" means one thing across all ten.</li>
</ul>

<p class="note">Two of these fill the gaps left in lesson-practice.ts: definiteness →
grammar-01, negation → grammar-10. Predication remains genuinely unannotated, so
grammar-03 keeps no practice link, which stays the honest answer.</p>`,
  'Roughly 108,000 annotated facts were ingested and never used. Five kinds, no hand-authored Arabic.'
), 'utf-8');

await writeFile(join(OUT, 'preview/spec-fsrs.html'), shell(
  'Spec — FSRS replaces SM-2, and the rating scale has to change', 'Product',
  `<p style="max-width:66ch">Both schedulers run SM-2: a fixed heuristic hand-tuned
in the 1980s. FSRS-6 is a memory model fitted to a public benchmark of roughly
<strong>519 million reviews from ~10,000 users</strong>, and it predicts recall more
accurately. Same retention for fewer reviews — which for hifz means less time spent
re-reading what is already solid.</p>

<p class="note">Two corrections to the obvious version of this argument. FSRS is
<strong>opt-in in Anki, not the default</strong> — the official manual still calls
SM-2 the baseline — so the case rests on the benchmark, not on Anki's endorsement.
And the algorithm is not being reimplemented: <code>ts-fsrs</code> (MIT, FSRS-6, zero
runtime dependencies) bundles to 58kb with no Node builtins. A fitted model with 21
parameters transcribed by hand from a wiki is how you get a scheduler that is subtly
wrong and schedules badly in silence.</p>

<h2>The scale is the real decision</h2>
<p style="max-width:66ch">FSRS grades on exactly four values. Today the app asks
three different questions:</p>
<table style="border-collapse:collapse;font-size:.85rem;max-width:640px">
  <tr style="text-align:left;color:var(--muted)">
    <th style="padding:6px 12px 6px 0">Surface</th><th style="padding:6px 0">Asks</th></tr>
  <tr><td style="padding:6px 12px 6px 0"><code>ReviewSession</code></td>
      <td style="padding:6px 0">five labels, 1–5</td></tr>
  <tr><td style="padding:6px 12px 6px 0"><code>Flashcards</code></td>
      <td style="padding:6px 0">four buttons mapped to 1, 3, 4, 5</td></tr>
  <tr><td style="padding:6px 12px 6px 0"><code>POST /:id/recall</code></td>
      <td style="padding:6px 0">derives it: <code>isCorrect ? 5 : quality - 2</code></td></tr>
</table>

<p class="note" style="border-color:${colour('color-error')}">Collapsing five labels
onto four grades would make two of them schedule identically. A scale where two
answers do the same thing is a lie to the learner, and it adds no information to a
model fitted on four. So the hifz review moves to four, matching what the flashcards
already effectively ask.</p>

<div style="max-width:520px;background:${colour('ground-900')};
 border:1px solid ${colour('ground-800')};border-radius:${tokens.get('radius-lg')};padding:20px">
  <p style="margin:0 0 14px;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;
   color:var(--muted)">How well did you remember?</p>
  ${[
    ['Not at all', 'Again', 'starts over', colour('color-error')],
    ['With difficulty', 'Hard', 'sooner than last time', colour('gold-500')],
    ['Correctly', 'Good', 'the normal step', colour('leaf-500')],
    ['Effortlessly', 'Easy', 'a longer jump', colour('leaf-400')],
  ].map(([label, grade, effect, c]) => `
  <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;
   border:1px solid ${c}55;border-radius:${tokens.get('radius-md')};padding:10px 12px;margin-bottom:8px">
    <span style="font-size:.9rem">${label}</span>
    <span style="font-size:.72rem;color:var(--muted)">${grade} · ${effect}</span>
  </div>`).join('')}
  <p style="margin:12px 0 0;font-size:.75rem;color:var(--muted)">The interval is shown
  after answering, not before — a learner who can see "+163 days" attached to one
  button is being invited to grade the schedule rather than their memory.</p>
</div>

<h2>Rules this follows</h2>
<ul style="max-width:66ch">
  <li><strong>Existing cards keep their history.</strong> Migration adds
  <code>stability</code> and <code>difficulty</code> beside the SM-2 columns rather
  than replacing them. A row with no FSRS state is seeded from its current interval on
  first review, so nobody's hifz schedule resets.</li>
  <li><strong>The derived rating stops guessing from the last one.</strong>
  <code>isCorrect ? 5 : quality - 2</code> computes the new grade from the previous
  grade, which is unrelated to how this attempt went. <code>gradeRecall</code> already
  returns an accuracy ratio, so recall maps that to a grade directly.</li>
  <li><strong>Status stays derived from the interval</strong> — learning, reviewing,
  mastered — because that vocabulary is already in the UI and the database. FSRS
  supplies the interval; the labels are ours.</li>
  <li><strong>Retention target is stated, not hidden.</strong> 0.9, the FSRS default,
  meaning roughly one lapse in ten reviews by design. Worth writing down, because a
  learner seeing a lapse should know it is expected rather than a fault.</li>
</ul>`,
  'A fitted model instead of a 1980s heuristic — and four grades instead of five, because two of five would have meant the same thing.'
), 'utf-8');

await writeFile(join(OUT, 'preview/spec-grammar-mastery.html'), shell(
  'Spec — the exercise bank records nothing', 'Product',
  `<p class="note" style="border-color:${colour('color-success')}">
<strong>Shipped — this describes a state that no longer exists.</strong> All three failures
below are fixed: <code>choose()</code> posts every answer, the handler asks the BANK for the
kind before falling back to lessons, and /progress reads per-kind mastery. Kept as the
record of how three bugs hid each other, in the same spirit as the banners on
<code>modules/</code>. The figures are as they were then — the bank now holds 41,709 items
across 30 kinds.</p>

<p style="max-width:66ch">The derived grammar bank is the largest thing in the
app: <strong>4,950 exercises</strong> across seven kinds and five levels, every item
traceable to a corpus row. A learner can work through all of them and the app will
remember <strong>none of it</strong>.</p>

<h2>Three failures stacked, which is why nobody noticed</h2>
<p class="note" style="border-color:${colour('color-error')}">
<strong>1 — Nothing is ever sent.</strong> <code>ExerciseRunner.choose()</code> updates
a local <code>score</code> state and stops there. <code>POST /api/grammar/exercise</code>
exists and has no caller.<br><br>
<strong>2 — If it were sent, the category lookup could not match.</strong> The handler
does <code>SELECT module FROM lessons WHERE id = ?</code> against the <em>exercise</em>
id. Bank ids look like <code>aspect-2-8-4-1</code>; lesson ids look like
<code>grammar-01</code>. A join between them returns zero rows — measured, not
assumed — so <code>grammar_mastery</code> is never written.<br><br>
<strong>3 — Nothing reads it.</strong> <code>GET /api/grammar/mastery</code> has no
caller, so the empty table was never visible either.</p>

<p style="max-width:66ch">Each failure hides the next. Fixing only the missing caller
would still write nothing; fixing only the join would still never fire.</p>

<h2>Where it surfaces — /progress</h2>
<div style="max-width:520px;background:${colour('ground-900')};
 border:1px solid ${colour('ground-800')};border-radius:${tokens.get('radius-lg')};padding:20px">
  <p style="margin:0 0 14px;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;
   color:var(--muted)">Grammar by exercise type</p>
  ${[
    ['Word meaning', 47, 52],
    ['Case ending (i’rab)', 12, 31],
    ['Verb form (I–XII)', 8, 9],
    ['Root identification', 3, 3],
  ].map(([label, right, total]) => {
    const pct = Math.round((right / total) * 100);
    const bar = pct >= 80 ? colour('leaf-500') : pct >= 50 ? colour('gold-500') : colour('color-error');
    return `<div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:4px">
        <span>${label}</span>
        <span style="color:var(--muted)">${right} of ${total} · ${pct}%</span></div>
      <div style="height:6px;background:${colour('ground-800')};border-radius:3px">
        <div style="height:6px;width:${pct}%;background:${bar};border-radius:3px"></div></div>
    </div>`;
  }).join('')}
  <p style="margin:14px 0 0;font-size:.75rem;color:var(--muted)">Only types you have
  attempted appear. An untouched type is not a weakness.</p>
</div>

<h2>Rules this follows</h2>
<ul style="max-width:66ch">
  <li><strong>Category is the exercise kind</strong> — the seven the bank actually
  has, resolved from <code>grammar_exercise_bank.kind</code>. The lesson-module
  lookup stays as a fallback so lesson-driven attempts keep working.</li>
  <li><strong>Attempted only.</strong> Seven rows where four have data would imply
  three weaknesses that were never measured — the same fabrication as inferring
  known roots from a placement score.</li>
  <li><strong>Raw counts beside the percentage.</strong> "3 of 3 · 100%" reads very
  differently from "47 of 52 · 90%", and the percentage alone hides which is which.</li>
  <li><strong>mastery_level gets derived or nothing.</strong> The column defaults to 1
  and has never been updated, so the endpoint's <code>masteryLevel</code> is the
  literal number 1 for everyone. Either it means something or it should not be
  returned.</li>
</ul>`,
  'The largest feature in the app stores no result. Three stacked failures, each hiding the next.'
), 'utf-8');

await writeFile(join(OUT, 'preview/spec-tutor-loop.html'), shell(
  'Spec — the tutor remembers, and suggests from your own errors', 'Product',
  `<p style="max-width:66ch">Two endpoints have been live since the tutor shipped and
no screen has ever called them. Both close a loop that is currently open.</p>

<h2>1 · It forgets you every visit</h2>
<p class="note" style="border-color:${colour('color-error')}"><code>tutor_conversations</code>
is written on every exchange — the INSERT runs, the rows are there — and
<code>GET /api/tutor/history</code> returns the last fifty. The chat mounts with
<code>messages = []</code> regardless. Every session starts from nothing while the
record of the last one sits in the database.</p>

<h2>2 · The suggestions are the same five strings for everyone</h2>
<p style="max-width:66ch">The chips today are hardcoded: <em>Explain madd types</em>,
<em>Help with grammar</em>, <em>Tips for memorization</em>. Meanwhile
<code>quiz_attempts</code> records what you actually got wrong, per lesson, on every
exercise you finish — and <code>GET /api/tutor/suggested-exercises</code> reads it.</p>

<p class="note" style="border-color:${colour('color-error')}"><strong>The endpoint is
not usable as written.</strong> It counts <code>COUNT(*)</code> of attempts scoring
zero and labels the result "3 errors in this area" — that is three <em>attempts</em>,
not three errors. It treats <code>questions_correct &gt; 0</code> as
<strong>"Strong performance in this area"</strong>, so one right out of ten is a
strength. And it never reads <code>questions_answered</code>, so no accuracy is
computed anywhere. Wiring it as-is would ship confident nonsense; the query is being
rewritten to rank by accuracy over answered questions.</p>

<h2>What the learner sees</h2>
<div style="max-width:560px;background:${colour('ground-900')};
 border:1px solid ${colour('ground-800')};border-radius:${tokens.get('radius-lg')};padding:20px">
  <p style="margin:0 0 4px;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;
   color:var(--muted)">Continue where you left off</p>
  <div style="border-left:2px solid ${colour('ground-800')};padding-left:12px;margin:12px 0">
    <p style="margin:0;font-size:.8rem;color:var(--muted)">You · 3 days ago</p>
    <p style="margin:2px 0 10px;font-size:.9rem">What is the difference between إِنَّ and أَنَّ?</p>
    <p style="margin:0;font-size:.8rem;color:var(--muted)">Look up</p>
    <p style="margin:2px 0 0;font-size:.9rem">Both introduce a nominal clause and put
    its subject in the accusative…</p>
  </div>

  <p style="margin:18px 0 8px;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;
   color:var(--muted)">Worth practising</p>
  <div style="display:flex;flex-direction:column;gap:8px">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;
     border:1px solid ${colour('color-error')}55;border-radius:${tokens.get('radius-md')};padding:10px 12px">
      <div><p style="margin:0;font-size:.9rem">Articles and Nouns</p>
        <p style="margin:2px 0 0;font-size:.75rem;color:var(--muted)">2 of 8 correct across 2 attempts</p></div>
      <span style="font-size:.75rem;color:${colour('gold-400')};white-space:nowrap">Practise →</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;
     border:1px solid ${colour('ground-800')};border-radius:${tokens.get('radius-md')};padding:10px 12px">
      <div><p style="margin:0;font-size:.9rem">The Idafa Construction</p>
        <p style="margin:2px 0 0;font-size:.75rem;color:var(--muted)">5 of 6 correct — nearly there</p></div>
      <span style="font-size:.75rem;color:${colour('gold-400')};white-space:nowrap">Practise →</span>
    </div>
  </div>
</div>

<h2>Rules this follows</h2>
<ul style="max-width:66ch">
  <li><strong>Accuracy, not attempt counts.</strong> Rank by
  <code>SUM(questions_correct) / SUM(questions_answered)</code>, and require at least
  one finished attempt — a lesson you have never opened is not a weakness.</li>
  <li><strong>Name the number.</strong> "2 of 8 correct across 2 attempts" is checkable
  by the learner. "3 errors in this area" was not even true.</li>
  <li><strong>Lesson titles, not ids.</strong> The endpoint returns
  <code>lesson_id</code>; the card joins <code>lessons</code> so the learner reads
  "Articles and Nouns" rather than <code>grammar-001</code>.</li>
  <li><strong>Generic chips stay as the empty state.</strong> A learner who has
  finished no exercises has no error history, and inventing a weakness for them would
  be the same fabrication as the assessment inferring known roots.</li>
  <li><strong>History is context, not a transcript.</strong> Restored turns render
  behind a rule and above the composer, so it is obvious what is old.</li>
</ul>`,
  'Two live endpoints no screen has ever called, one of which needs its query fixed first.'
), 'utf-8');

await writeFile(join(OUT, 'preview/spec-vocab-hifz.html'), shell(
  'Spec — vocabulary scoped to the hifz plan', 'Product',
  `<p style="max-width:66ch">F3, the last open plan item. The spaced-repetition
machinery is already complete — <code>POST /api/learning/vocabulary/start</code>
enrols words, <code>POST /api/learning/flashcards/review</code> grades them through
SM-2, and both work. <strong>The gap is only which words it picks.</strong></p>

<p class="note" style="border-color:${colour('color-error')}">Enrolment orders by
<code>frequency_rank</code> over the 103-row curated <code>vocabulary</code> table
and ignores the learner entirely. Someone memorising Al-Fatihah, Al-'Asr and
Al-Ikhlas — 58 words between them — is handed the globally commonest words instead,
so vocabulary study and memorisation pull in different directions when they should
be the same work seen twice.</p>

<h2>What a card should look like</h2>
<div style="max-width:480px;background:${colour('ground-900')};
 border:1px solid ${colour('gold-500')}66;border-radius:${tokens.get('radius-lg')};padding:22px">
  <div style="display:flex;justify-content:space-between;color:var(--muted);font-size:.75rem">
    <span>3 of 12 due</span><span style="color:${colour('gold-400')}">Al-Fatihah 1:2</span></div>
  <p class="ar" style="font-size:2.6rem;text-align:center;margin:16px 0 6px">ٱلْعَـٰلَمِينَ</p>
  <p style="text-align:center;color:var(--muted);font-size:.8rem;margin:0">l-ʿālamīna</p>
  <div style="border-top:1px solid ${colour('ground-800')};margin:18px 0 0;padding-top:14px">
    <p style="margin:0;font-size:1.05rem">of the worlds</p>
    <p style="margin:4px 0 0;color:var(--muted);font-size:.78rem">
      root <span class="ar">علم</span> · 73 occurrences · in an ayah you are memorising</p>
  </div>
</div>
<p class="note">The provenance line is the point: <strong>Al-Fatihah 1:2</strong>
tells the learner why this word and not another. A flashcard with no reason behind it
is a vocabulary list, which is the thing spaced repetition was supposed to replace.</p>

<h2>Selection order</h2>
<div class="grid" style="gap:10px;max-width:620px">
${box('1 · Words in your hifz plan', 'From <code>memorization</code> joined to <code>quran_word_gloss</code>. Ordered by how often the word occurs in the whole Quran, so the most reusable words in YOUR ayahs come first.')}
${box('2 · Then global frequency', 'When the plan is empty or exhausted, fall back to the curated table ordered by <code>frequency_rank</code> — the current behaviour, kept as the fallback rather than the default.')}
${box('Deduplicated by normalised form', 'The same word appears across ayahs with different diacritics and case endings. Without folding, a learner gets ٱلْعَٰلَمِينَ five times as five separate cards.')}
${box('Meaning: curated first, gloss second', '<code>vocabulary</code> has a dictionary meaning for 103 words; <code>quran_word_gloss</code> has a contextual gloss for all 77,429. Prefer the dictionary entry, fall back to the gloss, and never show a card with neither.')}
</div>
<p class="note">One behaviour worth stating: a word is <em>not</em> skipped because its
root is already known. Roots and words are different knowledge — knowing علم does not
mean you can read ٱلْعَـٰلَمِينَ — and conflating them would quietly shrink the queue
on a false equivalence.</p>`,
  'The SRS already works. It just was not studying the ayahs you are actually memorising.'
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
// Counted, not typed. This line read "9 preview cards" while 23 were being written —
// a hardcoded literal in the one script whose whole purpose is to stop hand-maintained
// numbers from drifting.
const cardCount = (await readdir(join(OUT, 'preview'))).filter((f) => f.endsWith('.html')).length;
process.stdout.write(
  `  ${cardCount} preview cards, colors_and_type.css (${tokens.size} tokens), README.md\n`
);
if (problems.length) {
  process.stdout.write(`  ${problems.length} token problem(s) reported above and documented in the bundle\n`);
}
