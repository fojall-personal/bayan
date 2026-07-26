#!/usr/bin/env node
/**
 * Rasterise design/app-icon.svg into the PNGs the app links.
 *
 *   node scripts/gen-icons.mjs
 *
 * Uses macOS `qlmanage`, which is present on any Mac and needs no install. That
 * is the trade: this regenerates on a Mac and not in CI, so the PNGs are
 * committed artifacts rather than build output. They change roughly never, and
 * the alternative was adding sharp or a native SVG library to a project that has
 * neither.
 *
 * Sizes are not arbitrary:
 *   180  apple-touch-icon, iPhone @3x — the one iOS actually wants
 *   167  iPad Pro
 *   152  iPad, iPad mini
 *   120  iPhone @2x
 *   512  manifest, and the PWA install prompt
 *   192  manifest, Android home screen
 *   32   favicon, browser tab on a HiDPI display
 *   16   favicon, tab on a 1x display
 *
 * 16 and 32 come from app-icon-small.svg, which drops detail that cannot be
 * resolved at that size. Everything else uses the full mark.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, renameSync, rmSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'src/app/public');
const TMP = join(root, '.icon-tmp');

const FULL = join(root, 'design/app-icon.svg');
const SMALL = join(root, 'design/app-icon-small.svg');

/** [size, source, output filename] */
const TARGETS = [
  [180, FULL, 'apple-touch-icon.png'],
  [167, FULL, 'apple-touch-icon-167.png'],
  [152, FULL, 'apple-touch-icon-152.png'],
  [120, FULL, 'apple-touch-icon-120.png'],
  [512, FULL, 'icon-512.png'],
  [192, FULL, 'icon-192.png'],
  [32, SMALL, 'favicon-32.png'],
  [16, SMALL, 'favicon-16.png'],
];

if (process.platform !== 'darwin') {
  console.error('This script uses macOS qlmanage. Regenerate on a Mac, or');
  console.error('replace it with rsvg-convert / sharp if that becomes a problem.');
  process.exit(1);
}

for (const src of [FULL, SMALL]) {
  if (!existsSync(src)) {
    console.error(`missing source: ${src}`);
    process.exit(1);
  }
}

mkdirSync(OUT, { recursive: true });
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

let failed = 0;
for (const [size, src, name] of TARGETS) {
  // qlmanage names its output <input>.png and only honours a max dimension, so
  // the square viewBox is what actually guarantees a square result.
  execFileSync('qlmanage', ['-t', '-s', String(size), '-o', TMP, src], {
    stdio: 'ignore',
  });
  const produced = join(TMP, `${src.split('/').pop()}.png`);
  if (!existsSync(produced)) {
    console.error(`  FAILED ${name} (${size}px) — qlmanage produced nothing`);
    failed++;
    continue;
  }
  const dest = join(OUT, name);
  renameSync(produced, dest);
  console.log(`  ${name.padEnd(28)} ${String(size).padStart(3)}px  ${statSync(dest).size} bytes`);
}

rmSync(TMP, { recursive: true, force: true });

if (failed) {
  console.error(`\n${failed} icon(s) failed.`);
  process.exit(1);
}
console.log(`\n${TARGETS.length} icons written to src/app/public/`);
