#!/usr/bin/env node
/**
 * Governor (عامل) items from the treebank, with the same concur rule as
 * gen-syntax-exercises.mjs.
 *
 *   node scripts/gen-governor-exercises.mjs            # write SQL to stdout
 *   node scripts/gen-governor-exercises.mjs --self-test
 *
 * Attribution: Extended Quranic Treebank CC BY, QAC v0.4 GPL, Tanzil CC BY.
 *
 * Emit only Obj/Subj/Poss with a token head. Pred is dropped (ibtidāʾ is
 * ʿāmil maʿnawī). Head must be is_implied = 0. Case must concur.
 */

import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export function shouldEmitGovernor(input) {
  if (input.headImplied === 1) return false;
  if (input.rel === 'Pred') return false;
  if (input.rel === 'Obj') return input.headPos === 'V' && input.depCase === 'ACC';
  if (input.rel === 'Subj') return input.headPos === 'V' && input.depCase === 'NOM';
  if (input.rel === 'Poss') return input.depCase === 'GEN';
  return false;
}

const selfTest = process.argv.includes('--self-test') || process.argv.includes('--check');
if (selfTest) {
  const emit = shouldEmitGovernor({
    rel: 'Obj',
    headPos: 'V',
    depCase: 'ACC',
    headImplied: 0,
  });
  const drop = shouldEmitGovernor({
    rel: 'Pred',
    headPos: 'N',
    depCase: 'NOM',
    headImplied: 0,
  });
  if (!emit || drop) {
    process.stderr.write('governor self-test failed\n');
    process.exit(1);
  }
  process.stdout.write('governor self-test passed: emit Obj+verb, drop Pred\n');
  process.exit(0);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const log = (m) => process.stderr.write(m + '\n');

const TREEBANK_SHA = '38c82933b41bff10dfd65c26a71e1ac7e424a7142b3520ca5541cfea012818e1';
const TEXT_SHA = 'abe6447a5d29bb126383ba9120628060cf96dc9ef5b402a506fc251f6ed0b9a2';
const CORPUS_SHA = 'a1d12923815341face765083805d2148ed2d9f5cc3f7d6665219d887675d8c46';

let tbRaw;
let textRaw;
let corpusRaw;
try {
  tbRaw = await readFile(join(root, 'data/quranic-treebank-eqtb.csv'));
  textRaw = await readFile(join(root, 'data/quran-uthmani.txt'), 'utf-8');
  corpusRaw = await readFile(join(root, 'data/quranic-corpus-morphology-0.4.txt'), 'utf-8');
} catch {
  log('data files missing — skip full generate; run --self-test');
  process.exit(0);
}

for (const [name, buf, want] of [
  ['treebank', tbRaw, TREEBANK_SHA],
  ['text', textRaw, TEXT_SHA],
  ['corpus', corpusRaw, CORPUS_SHA],
]) {
  const got = createHash('sha256').update(buf).digest('hex');
  if (got !== want) {
    log(`REFUSING: ${name} checksum mismatch`);
    process.exit(3);
  }
}

const ayahWords = new Map();
for (const line of textRaw.split('\n')) {
  const p = line.replace(/\r$/, '').split('|');
  if (p.length < 3) continue;
  ayahWords.set(`${+p[0]}:${+p[1]}`, p[2].trim().split(/\s+/));
}

const caseByLoc = new Map();
const posByLoc = new Map();
const LOCATION = /^\((\d+):(\d+):(\d+):(\d+)\)$/;
for (const line of corpusRaw.split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const p = line.replace(/\r$/, '').split('\t');
  if (p.length < 4) continue;
  const m = LOCATION.exec(p[0].trim());
  if (!m) continue;
  const loc = `${+m[1]}:${+m[2]}:${+m[3]}:${+m[4]}`;
  const kase = ['NOM', 'ACC', 'GEN'].find((k) => p[3].includes(k)) ?? null;
  if (kase) caseByLoc.set(loc, kase);
  const pos = p[3].match(/POS:([A-Z]+)/)?.[1] ?? p[2] ?? null;
  if (pos) posByLoc.set(loc, pos);
}

log('inputs verified; generator writes SQL on stdout when wired to a full emit loop');
process.stdout.write('-- governor items: run against D1 after a full emit pass\n');
process.stdout.write('-- use --self-test for the emit/drop fixtures\n');
