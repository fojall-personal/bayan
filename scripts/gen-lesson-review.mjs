#!/usr/bin/env node
/**
 * Build a human-readable review of every lesson.
 *
 *   node scripts/gen-lesson-review.mjs        # write docs/lesson-review.html
 *
 * ── What this is for ────────────────────────────────────────────────────────
 *
 * Five gates check that the lessons are STRUCTURALLY sound: every root exists in the
 * corpus, every Arabic example is attested in the Quran, sun and moon letters are
 * classified correctly, every lesson is reachable, every exercise answerable, every
 * option position unbiased. None of them can decide whether a lesson TEACHES. That is
 * the one open question on this project that no script can close, and closing it needs
 * a person reading the prose.
 *
 * The gates are NAMED below rather than counted. "Eight automated gates" was written into
 * the rendered page, went stale when the count changed, and was wrong in both directions
 * at once — nine gates exist, but only five of them say anything about lessons.
 *
 * So this renders the prose for reading, and tags every claim beside it with which gate
 * proved it — so the reader can skip what is already established and spend their
 * attention on what cannot be checked: whether the explanation is clear, whether the
 * examples illuminate it, whether the exercises test the thing the lesson taught.
 *
 * HTML rather than Markdown because the Arabic has to render in a real font with real
 * shaping, at a size where diacritics are legible. A markdown viewer will show the
 * characters; it will not show whether ٱلصَّلَوٰةَ looks right.
 *
 * The generated root lessons are summarised rather than listed in full. Reading
 * hundreds of instances of one template is one judgement — so the template is shown
 * once, filled with a real lesson, and the rest are tabulated.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'docs/lesson-review.html');

const literacy = JSON.parse(
  await readFile(join(root, 'content/literacy/lessons.json'), 'utf-8')
);
const grammarAuthored = JSON.parse(
  await readFile(join(root, 'content/grammar/lessons.json'), 'utf-8')
);
const authored = [...literacy, ...grammarAuthored];
const generated = JSON.parse(
  await readFile(join(root, 'content/grammar/root-lessons.json'), 'utf-8')
).lessons;

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** Arabic gets the face, the direction and the language. */
const ar = (text, size = '1.5rem') =>
  `<span lang="ar" dir="rtl" style="font-family:'Amiri',serif;font-size:${size};line-height:2.1">${esc(
    text
  )}</span>`;

/**
 * The gates that bear on lesson content, and what each one settles.
 *
 * Listed rather than counted so the page cannot claim a number that has drifted. If a
 * gate is added or removed, this list is the thing to edit — and check-pedagogy verifies
 * that every script named here exists.
 */
const LESSON_GATES = [
  {
    script: 'check-content.mjs',
    proves:
      'every Arabic example occurs in the Quran, every claimed root is in the corpus, ' +
      'sun and moon letters are classified against the canonical 14+14, and Arabic ' +
      'question marks sit only in Arabic sentences',
  },
  {
    script: 'check-pedagogy.mjs',
    proves:
      'every lesson is reachable from its prerequisites, carries at least two gradable ' +
      'exercises, and explains every one of them',
  },
  {
    script: 'gen-lessons-sql.mjs --check',
    proves: 'the SQL deployed to D1 still matches this content — no lesson ships stale',
  },
  {
    script: 'gen-root-lessons.mjs --check',
    proves:
      'the generated lessons match a fresh read of the corpus, every answer index is in ' +
      'range, and no option position holds more than half the answers',
  },
  {
    script: 'gen-content-manifest.mjs --check',
    proves: 'every exercise count quoted in the docs equals what is actually in the database',
  },
];

/** A claim and the gate that settles it. */
const verified = (what) =>
  `<span class="tag ok" title="checked automatically">✓ ${esc(what)}</span>`;
const judgement = (what) =>
  `<span class="tag ask" title="needs a human">? ${esc(what)}</span>`;

function exerciseBlock(ex, i) {
  const opts = (ex.options ?? [])
    .map((o, k) => {
      const isRight = Number(ex.correct) === k;
      return `<li class="${isRight ? 'right' : ''}">${
        /[؀-ۿ]/.test(o) ? ar(o, '1.2rem') : esc(o)
      }${isRight ? ' <em>← answer</em>' : ''}</li>`;
    })
    .join('');
  const pairs = (ex.pairs ?? [])
    .map((p) => `<li>${ar(p.item, '1.2rem')} → ${esc(p.answer)}</li>`)
    .join('');
  return `
  <div class="ex">
    <p class="exq"><strong>${i + 1}.</strong> ${esc(ex.question)} <span class="type">${esc(
      ex.type
    )}</span></p>
    ${opts ? `<ol class="opts">${opts}</ol>` : ''}
    ${pairs ? `<ul class="opts">${pairs}</ul>` : ''}
    ${
      ex.type === 'fill_blank' && ex.correct
        ? `<p class="ans">answer: ${
            /[؀-ۿ]/.test(String(ex.correct)) ? ar(ex.correct, '1.2rem') : esc(ex.correct)
          }</p>`
        : ''
    }
    ${ex.explanation ? `<p class="why">${esc(ex.explanation)}</p>` : '<p class="why missing">No explanation authored — the review screen will show nothing here.</p>'}
  </div>`;
}

function authoredLesson(l) {
  const c = l.content ?? {};
  const examples = (c.examples ?? [])
    .map(
      (e) => `<tr><td>${ar(e.arabic)}</td><td><em>${esc(e.transliteration)}</em></td>
        <td>${esc(e.meaning)}</td><td class="rule">${esc(e.rule ?? '')}</td></tr>`
    )
    .join('');
  const rules = (c.rules ?? [])
    .map(
      (r) => `<div class="rule-block">
        <p><strong>${esc(r.name)}</strong></p>
        <p>${esc(r.description)}</p>
        ${r.letters ? `<p>Letters: ${ar(r.letters, '1.3rem')}</p>` : ''}
        ${
          (r.examples ?? []).length
            ? `<p>${r.examples.map((x) => ar(x, '1.3rem')).join(' · ')}</p>`
            : ''
        }
      </div>`
    )
    .join('');

  return `
<section>
  <h2>${esc(l.title)}</h2>
  <p class="meta">${esc(l.id)} · ${esc(l.module)} · level ${l.level}
     ${(l.prerequisites ?? []).length ? `· after ${(l.prerequisites ?? []).map(esc).join(', ')}` : '· no prerequisite'}</p>

  <p class="tags">
    ${verified('every Arabic example occurs in the Quran')}
    ${verified('every claimed root exists in the corpus')}
    ${verified('sun/moon letters classified correctly')}
    ${verified('reachable, and every exercise answerable')}
    ${judgement('is the explanation clear?')}
    ${judgement('do the examples illuminate it?')}
    ${judgement('do the exercises test what was taught?')}
  </p>

  <h3>Explanation</h3>
  <p class="prose">${esc(c.explanation)}</p>

  ${examples ? `<h3>Examples</h3><table>${examples}</table>` : ''}
  ${rules ? `<h3>Rules</h3>${rules}` : ''}

  <h3>Exercises <span class="count">${(l.exercises ?? []).length}</span></h3>
  ${(l.exercises ?? []).map(exerciseBlock).join('')}
</section>`;
}

const sample = generated[0];
const generatedTable = generated
  .map(
    (l) =>
      `<tr><td>${ar(l.title.replace(/^The root /, '').split(' (')[0], '1.3rem')}</td>
       <td>${esc(l.id)}</td><td>${l.level}</td>
       <td>${(l.exercises ?? []).length}</td>
       <td class="rule">${esc(
         (l.content.explanation.match(/occurs ([\d,]+) times/) ?? [])[1] ?? '—'
       )}</td></tr>`
  )
  .join('');

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>Bayan — lesson review</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>
  :root { --ink:#f2ead7; --bg:#0d1f19; --panel:#16332a; --muted:#b7af98; --gold:#c9a227; --leaf:#7fd8c0; --err:#e5786a; }
  body { background:var(--bg); color:var(--ink); font-family:Inter,system-ui,sans-serif;
         max-width:60rem; margin:0 auto; padding:2.5rem 1.5rem 6rem; line-height:1.6; }
  h1 { font-size:1.9rem; margin-bottom:.25rem; }
  h2 { font-size:1.35rem; margin:0 0 .25rem; }
  h3 { font-size:.8rem; text-transform:uppercase; letter-spacing:.09em; color:var(--muted);
       margin:1.6rem 0 .5rem; }
  section { background:var(--panel); border-radius:12px; padding:1.6rem; margin:1.5rem 0; }
  .meta, .rule { color:var(--muted); font-size:.8rem; }
  .prose { max-width:66ch; }
  .tags { display:flex; flex-wrap:wrap; gap:.4rem; margin:.9rem 0 0; }
  .tag { font-size:.7rem; padding:.15rem .5rem; border-radius:99px; white-space:nowrap; }
  .tag.ok { background:rgba(127,216,192,.14); color:var(--leaf); }
  .tag.ask { background:rgba(201,162,39,.14); color:var(--gold); }
  table { border-collapse:collapse; width:100%; }
  td { padding:.4rem .6rem; border-bottom:1px solid rgba(255,255,255,.07); vertical-align:middle; }
  .ex { border:1px solid rgba(255,255,255,.09); border-radius:8px; padding:.9rem 1rem; margin:.6rem 0; }
  .exq { margin:0 0 .5rem; }
  .type { font-size:.68rem; color:var(--muted); border:1px solid rgba(255,255,255,.14);
          border-radius:99px; padding:.05rem .45rem; margin-left:.4rem; }
  .opts { margin:.3rem 0 .3rem 1.2rem; }
  .opts li.right { color:var(--leaf); }
  .opts li em { font-size:.7rem; color:var(--muted); }
  .why { font-size:.85rem; color:var(--muted); margin:.5rem 0 0; }
  .why.missing { color:var(--err); }
  .ans { font-size:.85rem; margin:.3rem 0 0; }
  .count { color:var(--muted); font-weight:400; }
  .lead { background:var(--panel); border-left:3px solid var(--gold); border-radius:8px;
          padding:1.2rem 1.4rem; max-width:66ch; }
  .rule-block { margin:.6rem 0; }
</style>
</head><body>

<h1>Lesson review</h1>
<p class="meta">Generated by scripts/gen-lesson-review.mjs · ${authored.length} authored,
   ${generated.length} generated · ${
     authored.reduce((n, l) => n + (l.exercises ?? []).length, 0) +
     generated.reduce((n, l) => n + (l.exercises ?? []).length, 0)
   } exercises</p>

<div class="lead">
  <p><strong>What to look at.</strong> These gates already prove the structural claims,
  and run on every push:</p>
  <ul class="meta" style="max-width:66ch">
    ${LESSON_GATES.map((g) => `<li><code>${g.script}</code> — ${g.proves}</li>`).join('\n    ')}
  </ul>
  <p>Anything they settle is tagged <span class="tag ok">✓</span> and you can skip it.</p>
  <p>What no script can decide is tagged <span class="tag ask">?</span>: whether the
  explanation is clear, whether the examples illuminate it, and whether the exercises
  test what the lesson actually taught. That is the reason this document exists.</p>
  <p><strong>Where a missing explanation is flagged in red</strong>, the result screen
  will show the learner nothing after they get it wrong.</p>
</div>

<h1 style="margin-top:2.5rem">The authored literacy and grammar lessons</h1>
<p class="meta">Written by hand. These are the ones worth your attention — the prose is
   not derived from anything, so nothing but a reader can verify it.</p>
${authored.map(authoredLesson).join('')}

<h1 style="margin-top:2.5rem">The ${generated.length} generated lessons</h1>
<div class="lead">
  <p>One template, filled from the corpus ${generated.length} times. Every fact in the
  prose is a query — occurrence count, attested words, their glosses, their locations,
  the part-of-speech tags — so reading all ${generated.length} is one judgement, not
  ${generated.length}. Judge the template below; the rest are tabulated after it.</p>
</div>
${authoredLesson(sample)}

<h3>All ${generated.length}, by frequency</h3>
<table>
  <tr><td class="rule">root</td><td class="rule">id</td><td class="rule">level</td>
      <td class="rule">exercises</td><td class="rule">occurrences</td></tr>
  ${generatedTable}
</table>

</body></html>
`;

await mkdir(join(root, 'docs'), { recursive: true });
await writeFile(OUT, html, 'utf-8');
process.stdout.write(
  `wrote docs/lesson-review.html — ${authored.length} authored + ${generated.length} generated\n`
);
