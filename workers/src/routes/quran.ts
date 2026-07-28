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

/**
 * English glosses for the grammatical roles worth putting in front of a reader.
 *
 * The ARABIC term is never written here — it comes from the treebank's own rel_ar column,
 * which is correct for all 129 relations. That matters: hand-authored Arabic is how a moon
 * letter reached the sun-letter list, and this file authors none.
 *
 * Curated rather than exhaustive. The treebank distinguishes 129 relations, and most are
 * parser bookkeeping — `root` marks the head of a sentence, `link` a preposition's
 * attachment, `NonRel` a prefix that carries no relation at all. Printing those beside a
 * word would bury the four a learner is actually being taught. `gen` is omitted for a
 * different reason: it says a word is governed by what precedes it, which the Parse lens
 * already shows as its genitive case.
 */
const ROLE_GLOSS: Record<string, string> = {
  Subj: 'subject — the doer',
  Obj: 'object — what the verb acts on',
  Pred: 'predicate — what is asserted',
  Poss: 'possessor, in a construct',
  Adj: 'adjective, describing the word before it',
  App: 'appositive — renames what precedes it',
  circ: 'circumstance — how or when',
  Spec: 'specifier of an amount',
  emph: 'emphasis',
  cond: 'the condition',
  neg: 'negation',
  sub: 'relative clause',
  conj: 'joined by a conjunction',
};

/**
 * كان and إنّ and their sisters, which the treebank spells out per governing word:
 * `subj <<kan>>`, `pred <<lays>>`, `subj<<in>>` — around a hundred variants. Matched by
 * shape rather than enumerated, since the Arabic side (اسم كان, خبر إن) already names the
 * governor exactly and enumerating a hundred English labels would be a hundred chances to
 * mistype one.
 */
function roleGloss(rel: string): string | null {
  if (ROLE_GLOSS[rel]) return ROLE_GLOSS[rel];
  const m = /^(subj|pred)\s*<<.+>>$/.exec(rel);
  if (m) return m[1] === 'subj' ? 'subject of a governing particle' : 'predicate of a governing particle';
  return null;
}

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
  // Which recording to return timings for. Defaults to the app's default reciter so
  // the common case needs no parameter; an unknown value simply yields no timings
  // rather than an error, because playback still works without them.
  const reciter = c.req.query('reciter') ?? 'Alafasy_128kbps';

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

    const [glosses, segments, known, rules, neighbours, timings, rootCounts, syntax, elided] =
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
      // Word-level recitation timings, so the reader can highlight what is sounding.
      // Empty for a reciter with no verified alignment — Husary is offered by the
      // player but quran-align covers a different encode of it, and highlighting the
      // wrong word is worse than highlighting none.
      db.query<{ word_index: number; start_ms: number; end_ms: number }>(
        `SELECT word_index, start_ms, end_ms
           FROM quran_word_timing
          WHERE reciter = ? AND surah_id = ? AND ayah_id = ?
          ORDER BY word_index`,
        [reciter, surah, ayah]
      ),
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
      // What each word DOES — فاعل, مفعول به, خبر, مضاف إليه.
      //
      // The Parse lens is headed "What the corpus states" and stated everything except
      // this, because the morphology does not record it. It comes from the treebank, whose
      // 117,947 rows had no reader at all until this query: the exercise generator reads
      // the source FILE, so the table was shipped to production and queried by nothing.
      //
      // Ordered by segment so a word's own stem wins over its prefix. is_implied rows are
      // excluded here: they have no morphology row to attach to, and an elided subject is
      // reported separately below rather than pretending to be a word on the page.
      db.query<{ word_index: number; segment_index: number; rel: string; rel_ar: string }>(
        `SELECT word_index, segment_index, rel, rel_ar
           FROM quran_syntax
          WHERE surah_id = ? AND ayah_id = ? AND is_implied = 0 AND rel IS NOT NULL
          ORDER BY word_index, segment_index`,
        [surah, ayah]
      ),
      // Words the treebank says are ELIDED — 11,157 across the Quran, most of them the
      // subject pronoun Arabic carries inside its verb. Worth surfacing because حذف is a
      // real feature of the language that a reader cannot see by looking, and because
      // this is the one thing in the parse that is not on the page.
      // Joined to its HEAD to recover a position. An implied token has word_index 0 by
      // definition — it is not a word on the page — so on its own it can only say "an
      // elided subject exists somewhere here". 1:5 has two identical (نحْنُ), and without
      // the head there is no way to say which verb each belongs to.
      db.query<{
        head_word: number | null;
        rel: string;
        rel_ar: string;
        token: string;
      }>(
        `SELECT h.word_index AS head_word, e.rel, e.rel_ar, e.token
           FROM quran_syntax e
           LEFT JOIN quran_syntax h
             ON h.sentence_id = e.sentence_id AND h.token_index = e.head_index
          WHERE e.surah_id = ? AND e.ayah_id = ?
            AND e.is_implied = 1 AND e.rel IS NOT NULL
          ORDER BY e.token_index`,
        [surah, ayah]
      ),
    ]);

    const knownRoots = new Set(known.map((k) => k.root));
    const occurrences = new Map(rootCounts.map((r) => [r.root, r.occurrences]));
    const timingByWord = new Map(timings.map((t) => [t.word_index, t]));
    const palette = new Map(rules.map((r) => [r.id, { color: r.color, name: r.name }]));

    // Role per (word, segment). Keyed on both because a prefixed word carries a relation
    // on its stem while the prefix carries its own, and attaching the stem's role to the
    // whole word would label بِسْمِ as a possessor when it is the بِ that governs.
    const roleBySeg = new Map<string, { role: string; roleArabic: string }>();
    for (const s of syntax) {
      const gloss = roleGloss(s.rel);
      if (!gloss) continue; // plumbing — see ROLE_GLOSS
      roleBySeg.set(`${s.word_index}:${s.segment_index}`, {
        role: gloss,
        roleArabic: s.rel_ar,
      });
    }

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
        // Milliseconds into this ayah's audio where the word is sounding. Null when
        // the reciter has no verified alignment.
        timing: timingByWord.get(g.position)
          ? {
              startMs: timingByWord.get(g.position)!.start_ms,
              endMs: timingByWord.get(g.position)!.end_ms,
            }
          : null,
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
          // What this segment DOES, from the treebank. Null where the treebank records
          // only plumbing for it, which is the honest answer rather than a guess — the
          // same call the Parse lens already makes for a prefix with no morphology.
          role: roleBySeg.get(`${g.position}:${s.segment_index}`)?.role ?? null,
          roleArabic: roleBySeg.get(`${g.position}:${s.segment_index}`)?.roleArabic ?? null,
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
        // Echoed so the client can assert the timings match the file it is playing.
        timingReciter: timings.length > 0 ? reciter : null,
        textUthmani: verse.text_uthmani,
        textSimple: verse.text_simple,
        // The column exists but is unpopulated for all 6,236 verses, so this is
        // null today. Returned anyway rather than omitted: the shape should not
        // change when the data arrives.
        translation: verse.translation,
        words,
        // Words the treebank says are ELIDED — present grammatically, absent from the
        // page. Mostly the subject pronoun that Arabic carries inside its verb, which is
        // why 1:5 نَعْبُدُ has a (نحْنُ) the reader will never see. Kept out of `words` on
        // purpose: `words` mirrors what is written, and inserting a token there would put
        // something on the page that is not in the mushaf.
        elided: elided.map((e) => ({
          // Which written word governs it, so the reader knows where to look. Null when
          // the head is itself elided.
          belongsToWord: e.head_word && e.head_word > 0 ? e.head_word : null,
          role: roleGloss(e.rel),
          roleArabic: e.rel_ar,
          // `(*)` is the treebank's placeholder for an omitted word it does not
          // reconstruct — as opposed to `(نحْنُ)`, where it does. Nulled rather than
          // printed: showing a learner "(*)" is worse than showing them the role alone.
          arabic: e.token && e.token !== '(*)' ? e.token : null,
        })),
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
