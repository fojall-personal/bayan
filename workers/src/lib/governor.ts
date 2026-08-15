/**
 * Token-governor emit rule and live samplers.
 *
 * Same concur-with-morphology discipline as gen-syntax-exercises.mjs.
 * Pred (ibtidāʾ) is ʿāmil maʿnawī — no token head — so it is dropped.
 *
 * Items are built from quran_syntax + morphology at request time, the same
 * way elided_subject is. The CSV generator is the offline twin of this rule.
 */

import type { Database } from './db';

export type GovernorRel = 'Obj' | 'Subj' | 'Poss';

const CASE_LABEL: Record<string, string> = {
  NOM: 'marfūʿ (مرفوع)',
  ACC: 'manṣūb (منصوب)',
  GEN: 'majrūr (مجرور)',
};

const REL_WHY: Record<GovernorRel, string> = {
  Obj: 'the verb is ʿāmil of the mafʿūl',
  Subj: 'the verb is ʿāmil of the fāʿil',
  Poss: 'the first noun of the iḍāfa governs the second',
};

export function shouldEmitGovernor(input: {
  rel: string | null;
  headPos: string | null;
  depCase: string | null;
  headImplied: number;
}): boolean {
  if (input.headImplied === 1) return false;
  if (input.rel === 'Pred') return false;
  if (input.rel === 'Obj') {
    return input.headPos === 'V' && input.depCase === 'ACC';
  }
  if (input.rel === 'Subj') {
    return input.headPos === 'V' && input.depCase === 'NOM';
  }
  if (input.rel === 'Poss') {
    return input.depCase === 'GEN';
  }
  return false;
}

export function isGovernorRel(rel: string | null): rel is GovernorRel {
  return rel === 'Obj' || rel === 'Subj' || rel === 'Poss';
}

export function caseLabel(kase: string | null): string {
  return (kase && CASE_LABEL[kase]) || kase || '';
}

function shuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let h = seed >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface GovernorItem {
  id: string;
  kind: 'governor';
  prompt: string;
  word: string;
  answer: string;
  options: string[];
  explanation: string;
  source: string;
  ayahText: string | null;
  surah: number;
  ayah: number;
  wordIndex: number;
  rel: GovernorRel;
}

export async function sampleGovernor(
  db: Database,
  limit: number
): Promise<GovernorItem[]> {
  const rows = await db.query<{
    sentence_id: number;
    token_index: number;
    surah_id: number;
    ayah_id: number;
    dep_word: number;
    head_word: number;
    rel: string;
    dep_case: string | null;
    head_pos: string | null;
    ayah_text: string | null;
  }>(
    `SELECT d.sentence_id, d.token_index, d.surah_id, d.ayah_id,
            d.word_index AS dep_word, h.word_index AS head_word,
            d.rel, m.case_case AS dep_case, hm.pos AS head_pos,
            q.text_uthmani AS ayah_text
       FROM quran_syntax d
       JOIN quran_syntax h
         ON h.sentence_id = d.sentence_id AND h.token_index = d.head_index
       JOIN quran_word_morphology m
         ON m.surah_id = d.surah_id AND m.ayah_id = d.ayah_id
        AND m.word_index = d.word_index AND m.segment_index = d.segment_index
       JOIN quran_word_morphology hm
         ON hm.surah_id = h.surah_id AND hm.ayah_id = h.ayah_id
        AND hm.word_index = h.word_index
        AND hm.segment_index = h.segment_index
       LEFT JOIN quran_verses q ON q.surah = d.surah_id AND q.ayah = d.ayah_id
      WHERE d.is_implied = 0
        AND h.is_implied = 0
        AND d.rel IN ('Obj', 'Subj', 'Poss')
        AND h.word_index >= 1
        AND d.word_index >= 1
      ORDER BY RANDOM()
      LIMIT ?`,
    [Math.max(limit * 8, 24)]
  );

  const out: GovernorItem[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!isGovernorRel(row.rel)) continue;
    if (
      !shouldEmitGovernor({
        rel: row.rel,
        headPos: row.head_pos,
        depCase: row.dep_case,
        headImplied: 0,
      })
    ) {
      continue;
    }
    const words = (row.ayah_text ?? '').trim().split(/\s+/).filter(Boolean);
    const dep = words[row.dep_word - 1];
    const head = words[row.head_word - 1];
    if (!dep || !head || dep === head) continue;
    const key = `${row.surah_id}:${row.ayah_id}:${row.dep_word}`;
    if (seen.has(key)) continue;
    const foils = words.filter((w, i) => i !== row.head_word - 1 && w !== head);
    const uniqueFoils = [...new Set(foils)];
    if (uniqueFoils.length < 3) continue;
    const seed = row.surah_id * 100003 + row.ayah_id * 1009 + row.dep_word;
    const picks = shuffle(uniqueFoils, seed).slice(0, 3);
    const options = shuffle([head, ...picks], seed + 17);
    seen.add(key);
    const kase = caseLabel(row.dep_case);
    out.push({
      id: `governor:${row.surah_id}:${row.ayah_id}:${row.dep_word}`,
      kind: 'governor',
      prompt: `Why is ${dep} ${kase} in ${row.surah_id}:${row.ayah_id}? Name the token ʿāmil.`,
      word: dep,
      answer: head,
      options,
      explanation:
        `عامل: ${head} (${REL_WHY[row.rel]}). Morphology case concurs. ` +
        `QAC GPL · treebank CC BY · Tanzil CC BY.`,
      source: `${row.surah_id}:${row.ayah_id}`,
      ayahText: row.ayah_text,
      surah: row.surah_id,
      ayah: row.ayah_id,
      wordIndex: row.dep_word,
      rel: row.rel,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export interface IrabWord {
  wordIndex: number;
  surface: string;
  caseCase: string | null;
  governor: string | null;
  governorOptions: string[];
}

export interface IrabParseItem {
  surah: number;
  ayah: number;
  text: string;
  words: IrabWord[];
  elided: { answer: string; options: string[] } | null;
}

const ELIDED_PRONOUNS = ['هُوَ', 'هِيَ', 'أَنْتَ', 'أَنْتُمْ', 'أنا', 'نحْنُ', 'هم'];

export async function loadIrabParse(
  db: Database,
  surah: number,
  ayah: number
): Promise<IrabParseItem | null> {
  const verse = await db.get<{ text_uthmani: string }>(
    `SELECT text_uthmani FROM quran_verses WHERE surah = ? AND ayah = ?`,
    [surah, ayah]
  );
  if (!verse) return null;
  const row = { surah, ayah, text_uthmani: verse.text_uthmani };

  const words = row.text_uthmani.trim().split(/\s+/).filter(Boolean);
  const deps = await db.query<{
    dep_word: number;
    head_word: number;
    rel: string;
    dep_case: string | null;
    head_pos: string | null;
  }>(
    `SELECT d.word_index AS dep_word, h.word_index AS head_word,
            d.rel, m.case_case AS dep_case, hm.pos AS head_pos
       FROM quran_syntax d
       JOIN quran_syntax h
         ON h.sentence_id = d.sentence_id AND h.token_index = d.head_index
       JOIN quran_word_morphology m
         ON m.surah_id = d.surah_id AND m.ayah_id = d.ayah_id
        AND m.word_index = d.word_index AND m.segment_index = d.segment_index
       JOIN quran_word_morphology hm
         ON hm.surah_id = h.surah_id AND hm.ayah_id = h.ayah_id
        AND hm.word_index = h.word_index AND hm.segment_index = h.segment_index
      WHERE d.surah_id = ? AND d.ayah_id = ?
        AND d.is_implied = 0 AND h.is_implied = 0
        AND d.rel IN ('Obj', 'Subj', 'Poss')
        AND h.word_index >= 1 AND d.word_index >= 1`,
    [row.surah, row.ayah]
  );

  const irabWords: IrabWord[] = [];
  const seenWord = new Set<number>();
  for (const d of deps) {
    if (!isGovernorRel(d.rel)) continue;
    if (
      !shouldEmitGovernor({
        rel: d.rel,
        headPos: d.head_pos,
        depCase: d.dep_case,
        headImplied: 0,
      })
    ) {
      continue;
    }
    if (seenWord.has(d.dep_word)) continue;
    const surface = words[d.dep_word - 1];
    const head = words[d.head_word - 1];
    if (!surface || !head) continue;
    const foils = [...new Set(words.filter((w, i) => i !== d.head_word - 1 && w !== head))];
    if (foils.length < 2) continue;
    seenWord.add(d.dep_word);
    const seed = row.surah * 100003 + row.ayah * 1009 + d.dep_word;
    irabWords.push({
      wordIndex: d.dep_word,
      surface,
      caseCase: d.dep_case,
      governor: head,
      governorOptions: shuffle([head, ...shuffle(foils, seed).slice(0, 3)], seed + 3),
    });
  }
  if (irabWords.length === 0) return null;

  const elided = await db.get<{ token: string }>(
    `SELECT token FROM quran_syntax
      WHERE surah_id = ? AND ayah_id = ?
        AND is_implied = 1 AND rel = 'Subj'
        AND token IS NOT NULL AND token NOT IN ('', '(*)')
      LIMIT 1`,
    [row.surah, row.ayah]
  );
  let elidedPayload: IrabParseItem['elided'] = null;
  if (elided) {
    const answer = elided.token.replace(/[()*]/g, '').trim();
    if (answer) {
      const others = ELIDED_PRONOUNS.filter((p) => p !== answer).slice(0, 3);
      elidedPayload = {
        answer,
        options: shuffle([answer, ...others], row.surah * 17 + row.ayah),
      };
    }
  }

  return {
    surah: row.surah,
    ayah: row.ayah,
    text: row.text_uthmani,
    words: irabWords,
    elided: elidedPayload,
  };
}

export async function pickIrabParse(
  db: Database,
  userId: string
): Promise<IrabParseItem | null> {
  const row = await db.get<{ surah: number; ayah: number }>(
    `SELECT v.surah, v.ayah
       FROM quran_verses v
      WHERE NOT EXISTS (
              SELECT 1 FROM memorization m
               WHERE m.user_id = ?
                 AND m.surah_id = v.surah
                 AND v.ayah BETWEEN m.ayah_from AND m.ayah_to
                 AND m.status = 'mastered'
            )
        AND EXISTS (
              SELECT 1 FROM quran_syntax d
               JOIN quran_syntax h
                 ON h.sentence_id = d.sentence_id AND h.token_index = d.head_index
               JOIN quran_word_morphology m
                 ON m.surah_id = d.surah_id AND m.ayah_id = d.ayah_id
                AND m.word_index = d.word_index AND m.segment_index = d.segment_index
               JOIN quran_word_morphology hm
                 ON hm.surah_id = h.surah_id AND hm.ayah_id = h.ayah_id
                AND hm.word_index = h.word_index AND hm.segment_index = h.segment_index
              WHERE d.surah_id = v.surah AND d.ayah_id = v.ayah
                AND d.is_implied = 0 AND h.is_implied = 0
                AND d.rel IN ('Obj', 'Subj', 'Poss')
                AND h.word_index >= 1 AND d.word_index >= 1
            )
      ORDER BY RANDOM()
      LIMIT 1`,
    [userId]
  );
  if (!row) return null;
  return loadIrabParse(db, row.surah, row.ayah);
}

export interface IrabGradeInput {
  surah: number;
  ayah: number;
  answers: Array<{ wordIndex: number; caseCase?: string; governor?: string }>;
  elision?: string;
}

export interface IrabGradeResult {
  surah: number;
  ayah: number;
  caseCorrect: number;
  caseTotal: number;
  governorCorrect: number;
  governorTotal: number;
  elisionCorrect: number | null;
  words: Array<{
    wordIndex: number;
    caseOk: boolean | null;
    governorOk: boolean | null;
    expectedCase: string | null;
    expectedGovernor: string | null;
  }>;
}

export async function gradeIrabParse(
  _db: Database,
  item: IrabParseItem,
  input: IrabGradeInput
): Promise<IrabGradeResult> {
  const byWord = new Map(item.words.map((w) => [w.wordIndex, w]));
  const words: IrabGradeResult['words'] = [];
  let caseCorrect = 0;
  let caseTotal = 0;
  let governorCorrect = 0;
  let governorTotal = 0;
  for (const ans of input.answers) {
    const gold = byWord.get(ans.wordIndex);
    if (!gold) continue;
    let caseOk: boolean | null = null;
    let governorOk: boolean | null = null;
    if (ans.caseCase !== undefined && gold.caseCase) {
      caseTotal += 1;
      caseOk = ans.caseCase === gold.caseCase;
      if (caseOk) caseCorrect += 1;
    }
    if (ans.governor !== undefined && gold.governor) {
      governorTotal += 1;
      governorOk = ans.governor === gold.governor;
      if (governorOk) governorCorrect += 1;
    }
    words.push({
      wordIndex: ans.wordIndex,
      caseOk,
      governorOk,
      expectedCase: gold.caseCase,
      expectedGovernor: gold.governor,
    });
  }
  let elisionCorrect: number | null = null;
  if (item.elided && input.elision !== undefined) {
    elisionCorrect = input.elision === item.elided.answer ? 1 : 0;
  }
  return {
    surah: item.surah,
    ayah: item.ayah,
    caseCorrect,
    caseTotal,
    governorCorrect,
    governorTotal,
    elisionCorrect,
    words,
  };
}
