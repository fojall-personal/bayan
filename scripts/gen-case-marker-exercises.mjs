#!/usr/bin/env node
/**
 * Case-marker exercises: what LETTER or VOWEL marks this case?
 *
 *   node scripts/gen-case-marker-exercises.mjs > /tmp/case-marker.sql
 *
 * Inputs: morphology v0.4 + Tanzil text, both SHA-pinned.
 *
 * The morphology records CASE (NOM/ACC/GEN). The Buckwalter form records the
 * ending. Traditional iʿrāb names the marker (ḍamma, wāw, alif, …). An item is
 * emitted only where form and case name the same marker. Diptotes (GEN wearing
 * fatḥa) are the one allowed disagreement, and they are labelled as such.
 */

import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const log = (m) => process.stderr.write(m + '\n');

const TEXT_SHA = 'abe6447a5d29bb126383ba9120628060cf96dc9ef5b402a506fc251f6ed0b9a2';
const CORPUS_SHA = 'a1d12923815341face765083805d2148ed2d9f5cc3f7d6665219d887675d8c46';

const textRaw = await readFile(join(root, 'data/quran-uthmani.txt'), 'utf-8');
const corpusRaw = await readFile(join(root, 'data/quranic-corpus-morphology-0.4.txt'), 'utf-8');
for (const [name, buf, want] of [
  ['text', textRaw, TEXT_SHA],
  ['corpus', corpusRaw, CORPUS_SHA],
]) {
  const got = createHash('sha256').update(buf).digest('hex');
  if (got !== want) {
    log(`REFUSING: ${name} checksum mismatch`);
    process.exit(3);
  }
}
log('inputs verified by checksum');

const MARKER_LABEL = {
  damma: 'ḍamma (ضمة)',
  fatha: 'fatḥa (فتحة)',
  kasra: 'kasra (كسرة)',
  waw: 'wāw (واو)',
  alif: 'alif (ألف)',
  ya: 'yāʾ (ياء)',
};

function observedMarker(form, number, gender) {
  if (number === 'D' && /(Ani|aA)$/.test(form)) return 'alif';
  if (number === 'D' && /ayoni$/.test(form)) return 'ya';
  if (number === 'P' && gender === 'M' && /uwna$/.test(form)) return 'waw';
  if (number === 'P' && gender === 'M' && /iyna$/.test(form)) return 'ya';
  if (form === '*uw' || (number === 'S' && /uw$/.test(form))) return 'waw';
  if (/uN?$/.test(form) || /N$/.test(form)) return 'damma';
  if (/FA$/.test(form) || /aF?$/.test(form) || /F$/.test(form)) return 'fatha';
  if (/iK?$/.test(form) || /K$/.test(form)) return 'kasra';
  return null;
}

function expectedMarker(kase, number, gender) {
  if (number === 'D') return kase === 'NOM' ? 'alif' : 'ya';
  if (number === 'P' && gender === 'M') return kase === 'NOM' ? 'waw' : 'ya';
  if (kase === 'NOM') return 'damma';
  if (kase === 'ACC') return 'fatha';
  if (kase === 'GEN') return 'kasra';
  return null;
}

function shouldEmit(input) {
  if (input.pos !== 'N' || !input.kase || !input.form) return null;
  const observed = observedMarker(input.form, input.number, input.gender);
  const expected = expectedMarker(input.kase, input.number, input.gender);
  if (!observed || !expected) return null;
  if (observed === expected) return { marker: observed, diptote: false };
  if (
    input.kase === 'GEN' &&
    expected === 'kasra' &&
    observed === 'fatha' &&
    (input.number === 'S' || !input.number)
  ) {
    return { marker: 'fatha', diptote: true };
  }
  return null;
}

const ayahWords = new Map();
for (const line of textRaw.split('\n')) {
  const p = line.replace(/\r$/, '').split('|');
  if (p.length < 3) continue;
  ayahWords.set(`${+p[0]}:${+p[1]}`, p[2].trim().split(/\s+/));
}

const LOCATION = /^\((\d+):(\d+):(\d+):(\d+)\)$/;
const PNG_RE = /\|([123])(M|F)?(S|D|P)\|?/;
const formFreq = new Map();
const items = [];
const seen = new Set();

for (const line of corpusRaw.split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const p = line.replace(/\r$/, '').split('\t');
  if (p.length < 4) continue;
  const m = LOCATION.exec(p[0].trim());
  if (!m) continue;
  formFreq.set(p[1], (formFreq.get(p[1]) ?? 0) + 1);
  const pos = p[3].match(/POS:([A-Z]+)/)?.[1] ?? p[2] ?? null;
  const kase = ['NOM', 'ACC', 'GEN'].find((k) => p[3].includes(k)) ?? null;
  const pgn = p[3].match(PNG_RE);
  const ng = p[3].match(/\|(M|F)(S|D|P)\|/);
  const gender = pgn?.[2] ?? ng?.[1] ?? null;
  const number = pgn?.[3] ?? ng?.[2] ?? null;
  const emit = shouldEmit({ pos, kase, number, gender, form: p[1] });
  if (!emit) continue;
  const surah = +m[1];
  const ayah = +m[2];
  const word = +m[3];
  const words = ayahWords.get(`${surah}:${ayah}`);
  const surface = words?.[word - 1];
  if (!surface) continue;
  const key = `case_marker|${surah}:${ayah}|${word}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const answer = MARKER_LABEL[emit.marker];
  const others = Object.values(MARKER_LABEL).filter((l) => l !== answer);
  const seed = `${surah}:${ayah}:${word}`;
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const shuffled = others
    .map((v, i) => {
      h = (Math.imul(h, 1103515245) + 12345) >>> 0;
      return { v, k: (h ^ Math.imul(i, 2654435761)) >>> 0 };
    })
    .sort((a, b) => a.k - b.k)
    .map((x) => x.v)
    .slice(0, 3);
  const options = [answer, ...shuffled];
  for (let i = options.length - 1; i > 0; i -= 1) {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    const j = h % (i + 1);
    [options[i], options[j]] = [options[j], options[i]];
  }
  const freq = formFreq.get(p[1]) ?? 0;
  const level = freq >= 300 ? 1 : freq >= 120 ? 2 : freq >= 50 ? 3 : freq >= 15 ? 4 : 5;
  items.push({
    id: `case_marker-${surah}-${ayah}-${word}`,
    kind: 'case_marker',
    level,
    wordArabic: surface,
    prompt: `What marks the case of ${surface} in ${surah}:${ayah}?`,
    answer,
    options,
    explanation: emit.diptote
      ? `${surface} is genitive but wears ${answer}. That is the diptote ` +
        `(ممنوع من الصرف) ending: fatḥa stands in for kasra. The form and the ` +
        `morphology case both had to be present for this question to exist.`
      : `${surface} is ${kase === 'NOM' ? 'nominative' : kase === 'ACC' ? 'accusative' : 'genitive'}; ` +
        `the marker is ${answer}. The Buckwalter ending and the morphology case ` +
        `concur. Quranic Arabic Corpus v0.4 (${surah}:${ayah}).`,
    surah,
    ayah,
    word,
  });
}

const defects = [];
for (const e of items) {
  if (!e.options.includes(e.answer)) defects.push(`${e.id}: answer missing`);
  if (new Set(e.options).size !== 4) defects.push(`${e.id}: ${e.options.length} options`);
}
if (defects.length) {
  for (const d of defects.slice(0, 12)) log(`  ✘ ${d}`);
  process.exit(3);
}

const PER_MARKER = Number(process.env.PER_MARKER ?? 80);
function spread(rows, cap) {
  const by = new Map();
  for (const r of rows) {
    if (!by.has(r.surah)) by.set(r.surah, []);
    by.get(r.surah).push(r);
  }
  const qs = [...by.keys()].sort((a, b) => a - b).map((k) => by.get(k));
  const out = [];
  let i = 0;
  while (out.length < cap && qs.some((q) => q.length)) {
    const q = qs[i % qs.length];
    if (q.length) out.push(q.shift());
    i += 1;
  }
  return out;
}
const byMarkerAll = new Map();
for (const e of items) {
  if (!byMarkerAll.has(e.answer)) byMarkerAll.set(e.answer, []);
  byMarkerAll.get(e.answer).push(e);
}
const chosen = [];
for (const k of [...byMarkerAll.keys()].sort()) {
  chosen.push(...spread(byMarkerAll.get(k), PER_MARKER));
}
const byMarker = {};
for (const e of chosen) byMarker[e.answer] = (byMarker[e.answer] ?? 0) + 1;
log(`case_marker       ${items.length} corroborated, selected ${chosen.length}`);
log(`  ${JSON.stringify(byMarker)}`);

const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const out = ['-- Generated by scripts/gen-case-marker-exercises.mjs. Do not edit.'];
out.push('-- Quranic Arabic Corpus v0.4 (Kais Dukes, GNU GPL). Tanzil CC BY.');
out.push("DELETE FROM grammar_exercise_bank WHERE kind = 'case_marker';");
for (const e of chosen) {
  out.push(
    'INSERT OR REPLACE INTO grammar_exercise_bank (id, kind, level, word_arabic, ' +
      'word_buckwalter, prompt, answer, options, explanation, surah_id, ayah_id, ' +
      'word_index, segment_index, root) VALUES (' +
      [
        q(e.id),
        q(e.kind),
        e.level,
        q(e.wordArabic),
        q(''),
        q(e.prompt),
        q(e.answer),
        q(JSON.stringify(e.options)),
        q(e.explanation),
        e.surah,
        e.ayah,
        e.word,
        1,
        'NULL',
      ].join(', ') +
      ');'
  );
}
process.stdout.write(out.join('\n') + '\n');
