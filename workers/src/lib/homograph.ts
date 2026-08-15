/**
 * Live homograph items from morphology when the bank has no rows.
 *
 * Same pairing rule as scripts/gen-homograph-exercises.mjs: one spelling, two
 * attested jobs, options are only senses this lemma actually takes.
 */

import type { Database } from './db';

export const HOMOGRAPH_ROLE: Record<string, string> = {
  REL: 'a relative pronoun ("that which", "who")',
  NEG: 'a negation ("not")',
  INTG: 'a question word ("what?", "who?")',
  COND: 'a conditional ("if", "whoever")',
  SUB: 'a subordinating conjunction ("that")',
  PRO: 'a prohibition ("do not")',
  INT: 'an explanatory particle ("namely")',
  P: 'a preposition ("until", "up to")',
  INC: 'an inceptive particle — it starts a new clause',
  EXH: 'an exhortation ("if only", "why not")',
  SUP: 'a supplemental particle',
  PREV: 'a preventive particle — it stops the word before it governing',
};

export interface HomographItem {
  id: string;
  kind: 'homograph';
  prompt: string;
  word: string;
  answer: string;
  options: string[];
  explanation: string;
  source: string;
}

export async function sampleHomograph(
  db: Database,
  limit: number
): Promise<HomographItem[]> {
  const rows = await db.query<{
    lemma: string;
    pos: string;
    surah_id: number;
    ayah_id: number;
    word_index: number;
    ayah_text: string | null;
    segs: number;
  }>(
    `SELECT m.lemma, m.pos, m.surah_id, m.ayah_id, m.word_index,
            q.text_uthmani AS ayah_text,
            (SELECT COUNT(*) FROM quran_word_morphology s
              WHERE s.surah_id = m.surah_id AND s.ayah_id = m.ayah_id
                AND s.word_index = m.word_index) AS segs
       FROM quran_word_morphology m
       LEFT JOIN quran_verses q ON q.surah = m.surah_id AND q.ayah = m.ayah_id
      WHERE m.root IS NULL
        AND m.lemma IS NOT NULL AND m.lemma <> ''
        AND m.pos IS NOT NULL
        AND m.lemma IN (
          SELECT lemma FROM quran_word_morphology
           WHERE root IS NULL AND lemma IS NOT NULL AND lemma <> '' AND pos IS NOT NULL
           GROUP BY lemma
          HAVING COUNT(DISTINCT pos) >= 2
        )
      ORDER BY RANDOM()
      LIMIT ?`,
    [Math.max(limit * 12, 40)]
  );

  const lemmaPos = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!lemmaPos.has(r.lemma)) lemmaPos.set(r.lemma, new Set());
    lemmaPos.get(r.lemma)!.add(r.pos);
  }

  const out: HomographItem[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (r.segs !== 1) continue;
    const senses = [...(lemmaPos.get(r.lemma) ?? [])].filter((p) => HOMOGRAPH_ROLE[p]);
    if (senses.length < 2 || !HOMOGRAPH_ROLE[r.pos]) continue;
    const key = `${r.surah_id}:${r.ayah_id}:${r.lemma}`;
    if (seen.has(key)) continue;
    const words = (r.ayah_text ?? '').trim().split(/\s+/).filter(Boolean);
    const surface = words[r.word_index - 1];
    if (!surface) continue;
    seen.add(key);
    const answer = HOMOGRAPH_ROLE[r.pos];
    const options = senses.map((p) => HOMOGRAPH_ROLE[p]);
    const marked = words
      .map((w, i) => (i === r.word_index - 1 ? `⟪${w}⟫` : w))
      .join(' ');
    const others = senses.filter((p) => p !== r.pos).map((p) => HOMOGRAPH_ROLE[p]);
    out.push({
      id: `homograph:${r.surah_id}:${r.ayah_id}:${r.word_index}`,
      kind: 'homograph',
      prompt: `In this ayah, what job does ⟪${surface}⟫ do?\n\n${marked}`,
      word: surface,
      answer,
      options,
      explanation:
        `Here ${surface} is ${answer}. The same spelling is also ` +
        `${others.join(', or ')} elsewhere in the Quran. Quranic Arabic Corpus v0.4 ` +
        `(${r.surah_id}:${r.ayah_id}).`,
      source: `${r.surah_id}:${r.ayah_id}`,
    });
    if (out.length >= limit) break;
  }
  return out;
}