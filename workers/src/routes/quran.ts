// One ayah, as one object.
//
// Everything this returns already existed, but scattered: the text in
// quran_verses, the tajweed tags behind GET /api/tajweed/verses/:surah, the
// glosses in quran_word_gloss, the parse in quran_word_morphology, and the
// known-root flag in user_known_root. A screen assembling that made four requests
// and joined them in the browser — which is exactly why reciting, reading, parsing
// and memorizing ended up as five separate pages with five separate surah pickers.
//
// The ayah is the unit of work, so the API should have a unit that matches it.

import { Hono } from 'hono';
import type { AppEnv } from '../lib/context';
import { getDb } from '../lib/db';
import { colourTags, type RawTag } from '../lib/tajweed-colors';
import { buckwalterToArabic } from '../lib/buckwalter';

export const quranRoutes = new Hono<AppEnv>();

interface VerseRow {
  surah: number;
  ayah: number;
  text_uthmani: string;
  text_simple: string | null;
  translation: string | null;
  tajweed_tags: string | null;
}

interface WordRow {
  position: number;
  arabic: string | null;
  transliteration: string | null;
  english: string | null;
}

interface SegRow {
  word_index: number;
  segment_index: number;
  form: string | null;
  root: string | null;
  lemma: string | null;
  pos: string | null;
  verb_form: string | null;
  aspect: string | null;
  voice: string | null;
  case_case: string | null;
  gender: string | null;
  number: string | null;
  person: string | null;
}

// GET /api/quran/ayah/:surah/:ayah
quranRoutes.get('/ayah/:surah/:ayah', async (c) => {
  const userId = c.get('userId');
  const surah = Number(c.req.param('surah'));
  const ayah = Number(c.req.param('ayah'));

  // Reject out-of-range before querying. A 404 for "surah 200" is a better answer
  // than an empty result that looks like missing data.
  if (!Number.isInteger(surah) || surah < 1 || surah > 114 ||
      !Number.isInteger(ayah) || ayah < 1) {
    return c.json({ error: 'Expected surah 1–114 and a positive ayah' }, 400);
  }

  const db = getDb(c);

  try {
    const verse = await db.get<VerseRow>(
      `SELECT surah, ayah, text_uthmani, text_simple, translation, tajweed_tags
         FROM quran_verses WHERE surah = ? AND ayah = ?`,
      [surah, ayah]
    );
    if (!verse) return c.json({ error: `No ayah ${surah}:${ayah}` }, 404);

    const [glosses, segments, known, rules, neighbours, rootCounts] =
      await Promise.all([
      db.query<WordRow>(
        `SELECT position, arabic, transliteration, english
           FROM quran_word_gloss WHERE surah_id = ? AND ayah_id = ? ORDER BY position`,
        [surah, ayah]
      ),
      db.query<SegRow>(
        `SELECT word_index, segment_index, form, root, lemma, pos,
                verb_form, aspect, voice, case_case, gender, number, person
           FROM quran_word_morphology
          WHERE surah_id = ? AND ayah_id = ?
          ORDER BY word_index, segment_index`,
        [surah, ayah]
      ),
      db.query<{ root: string }>(
        `SELECT root FROM user_known_root WHERE user_id = ?`,
        [userId]
      ),
      db.query<{ id: string; name: string; color: string }>(
        `SELECT id, name, color FROM tajweed_rules`
      ),
      // How many ayahs this surah has, so the reader can page without a second call.
      db.get<{ n: number }>(
        `SELECT COUNT(*) AS n FROM quran_verses WHERE surah = ?`,
        [surah]
      ),
      // How often each root in THIS ayah occurs across the whole Quran.
      //
      // The number is the argument for learning a word: علم appearing 854 times is
      // worth an afternoon, a root appearing twice is not. Al Quran by Greentech
      // shows this for free and it was the one thing the reader lacked. Scoped to the
      // roots present in this ayah rather than counting all 1,642, and it rides the
      // same Promise.all so it costs no extra round trip.
      db.query<{ root: string; occurrences: number }>(
        `SELECT root, COUNT(*) AS occurrences
           FROM quran_word_morphology
          WHERE root IS NOT NULL
            AND root IN (
              SELECT DISTINCT root FROM quran_word_morphology
               WHERE surah_id = ? AND ayah_id = ? AND root IS NOT NULL
            )
          GROUP BY root`,
        [surah, ayah]
      ),
    ]);

    const knownRoots = new Set(known.map((k) => k.root));
    const occurrences = new Map(rootCounts.map((r) => [r.root, r.occurrences]));
    const palette = new Map(rules.map((r) => [r.id, { color: r.color, name: r.name }]));

    // Group segments under their word, so the client never re-derives word shape.
    const segsByWord = new Map<number, SegRow[]>();
    for (const s of segments) {
      const list = segsByWord.get(s.word_index) ?? [];
      list.push(s);
      segsByWord.set(s.word_index, list);
    }

    const words = glosses.map((g) => {
      const segs = segsByWord.get(g.position) ?? [];
      const roots = segs.map((s) => s.root).filter((r): r is string => !!r);
      const unknownRoots = roots.filter((r) => !knownRoots.has(r));
      return {
        position: g.position,
        arabic: g.arabic,
        transliteration: g.transliteration,
        english: g.english,
        roots,
        // A word with no rooted segment is treated as known: particles, pronouns
        // and the disconnected letters are learned in the first week and are not
        // what gates comprehension. Same rule the coverage endpoint uses, so the
        // two can never disagree about what "known" means.
        known: unknownRoots.length === 0,
        unknownRoots,
        // Whole-Quran frequency of this word's root(s), highest first — the reason to
        // learn it or skip it. Null-free: a word with no rooted segment has no count
        // rather than a zero, which would read as "never occurs".
        rootOccurrences: roots
          .map((r) => ({ root: r, occurrences: occurrences.get(r) ?? 0 }))
          .sort((a, b) => b.occurrences - a.occurrences),
        // `form` and `lemma` are stored in Buckwalter, and both were handed to the
        // client raw. `arabic` was never rendered so it merely lied, but the Parse
        // lens prints the lemma — so /read showed "lemma Hamod", "lemma {ll~ah",
        // "lemma rab~". GET /api/grammar/word converted these all along; this
        // endpoint, written later to replace it, did not.
        segments: segs.map((s) => ({
          index: s.segment_index,
          arabic: s.form ? buckwalterToArabic(s.form) : null,
          root: s.root,
          lemma: s.lemma ? buckwalterToArabic(s.lemma) : null,
          partOfSpeech: s.pos,
          verbForm: s.verb_form,
          aspect: s.aspect,
          voice: s.voice,
          case: s.case_case,
          gender: s.gender,
          number: s.number,
          person: s.person,
        })),
      };
    });

    // Stored as JSON on the verse row, carrying only (rule, start, end) — the
    // ingest has no opinion on presentation, and colour comes from tajweed_rules.
    let raw: RawTag[] = [];
    try {
      raw = verse.tajweed_tags ? (JSON.parse(verse.tajweed_tags) as RawTag[]) : [];
    } catch {
      // A malformed blob should cost the colours, not the whole ayah.
      raw = [];
    }
    const tajweed = colourTags(raw, palette);

    const toLearn = words.filter((w) => !w.known).length;

    return c.json({
      data: {
        surah,
        ayah,
        ayahsInSurah: neighbours?.n ?? null,
        textUthmani: verse.text_uthmani,
        textSimple: verse.text_simple,
        // The column exists but is unpopulated for all 6,236 verses, so this is
        // null today. Returned anyway rather than omitted: the shape should not
        // change when the data arrives.
        translation: verse.translation,
        words,
        tajweed,
        // The headline the screen shows. Computed here so the client cannot get a
        // different answer than /api/progress/coverage would give.
        wordsToLearn: toLearn,
        fullyReadable: toLearn === 0,
      },
      attribution: {
        text: 'Tanzil Uthmani (CC-BY)',
        morphology: 'Quranic Arabic Corpus v0.4, Kais Dukes (GPL)',
        glosses: 'quran.com word-by-word',
      },
    });
  } catch (error) {
    console.error('Ayah error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
