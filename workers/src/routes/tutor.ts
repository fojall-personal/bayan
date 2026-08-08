import { Hono } from 'hono';
import type { AppEnv } from '../lib/context';
import { getDb } from '../lib/db';
import type { Database } from '../lib/db';

import {
  CAPABILITIES_REPLY,
  classify,
  normaliseArabic,
  topicsFor,
  type Intent,
} from '../lib/tutor-grounding';
import { buckwalterToArabic, rootToArabic } from '../lib/buckwalter';
import { buildFamily, grammarFacts, type MorphRow } from '../lib/root-families';
import type {
  AssessmentResultsRow,
  LessonProgressRow,
  MemorizationRow,
  QuizAttemptsRow,
  TutorConversationsRow,
  UsersRow,
} from '../db/schema';

export const tutorRoutes = new Hono<AppEnv>();

// POST /api/tutor/chat — Chat with AI tutor (context-aware)
tutorRoutes.post('/chat', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);
  const { message, conversationHistory } = await c.req.json();

  try {
    // Load user context for personalized responses
    const [user, assessment, recentLessons, memorizationDue] =
      await Promise.all([
        db.get<UsersRow>(
          `SELECT * FROM users WHERE id = ?`,
          [userId]
        ),
        db.get<AssessmentResultsRow>(
          `SELECT * FROM assessment_results WHERE user_id = ? ORDER BY completed_at DESC LIMIT 1`,
          [userId]
        ),
        db.query<LessonProgressRow>(
          `SELECT * FROM lesson_progress WHERE user_id = ? ORDER BY last_practiced DESC LIMIT 5`,
          [userId]
        ),
        db.query<Pick<MemorizationRow, 'surah_id' | 'status'>>(
          `SELECT surah_id, status FROM memorization
           WHERE user_id = ? AND next_review <= datetime('now')
           LIMIT 10`,
          [userId]
        ),
      ]);

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Calculate weak areas from recent quiz attempts
    const errors = await db.query<Pick<QuizAttemptsRow, 'lesson_id' | 'module' | 'questions_correct' | 'questions_answered'>>(
      `SELECT lesson_id, module, questions_correct, questions_answered
       FROM quiz_attempts WHERE user_id = ? ORDER BY completed_at DESC LIMIT 20`,
      [userId]
    );

    const moduleErrors: Record<string, number> = {};
    errors.forEach((attempt) => {
      const answered = attempt.questions_answered as number;
      if (answered === 0) return; // No answers — not an error the weak-area sort should act on.
      const rate = (attempt.questions_correct as number) / answered;
      moduleErrors[attempt.module as string] =
        (moduleErrors[attempt.module as string] || 0) + (1 - rate);
    });

    const weakAreas = Object.entries(moduleErrors)
      .sort((a, b) => b[1] - a[1])
      .map(([mod]) => mod)
      .slice(0, 3);

    // Answer from data. The previous implementation was a keyword matcher with
    // hardcoded replies, and it invented Arabic: its madd answer cited
    // السَّآمَّة and الْحَآئِرِينَ, neither of which occurs anywhere in the
    // Quran (0 occurrences each, checked against the pinned text). Everything
    // below is a record lookup that cites its source, and says so when the
    // corpus is silent.
    const intent = classify(message);
    const response = await answerFromData(db, intent, {
      memorizationDue: (memorizationDue || []).length,
      weakAreas,
    });

    // Save conversation
    await db.run(
      `INSERT INTO tutor_conversations (id, user_id, user_message, assistant_message, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [crypto.randomUUID(), userId, message, response]
    );

    // Topics come from the resolved intent rather than a second keyword scan of
    // the same string.
    const topics = topicsFor(intent);
    for (const topic of topics) {
      await db.run(
        `INSERT OR IGNORE INTO tutor_topic_history (id, user_id, topic, discussed_at)
         VALUES (?, ?, ?, datetime('now'))`,
        [crypto.randomUUID(), userId, topic]
      );
    }

    return c.json({ data: { response, topics } });
  } catch (error) {
    console.error('Tutor chat error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/tutor/suggested-exercises — Get exercise recommendations based on error patterns
tutorRoutes.get('/suggested-exercises', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

  try {
    // Rank by accuracy over questions actually answered.
    //
    // The previous version was unusable in three separate ways, and wiring it to a
    // screen would have shipped confident nonsense:
    //
    //   COUNT(*) ... WHERE questions_correct = 0   → labelled "N errors in this
    //     area", but it counts ATTEMPTS that scored zero, not errors.
    //   WHERE questions_correct > 0                → labelled "Strong performance",
    //     so one right out of ten qualified as a strength.
    //   questions_answered                         → never read, so no accuracy was
    //     computed anywhere despite the column existing.
    //
    // One row per lesson, aggregated across attempts, with the lesson title joined
    // so the learner reads "Articles and Nouns" rather than grammar-001.
    const rows = await db.query<{
      lesson_id: string;
      module: string;
      title: string | null;
      attempts: number;
      answered: number;
      correct: number;
    }>(
      `SELECT qa.lesson_id, qa.module,
              l.title,
              COUNT(*)                     AS attempts,
              SUM(qa.questions_answered)   AS answered,
              SUM(qa.questions_correct)    AS correct
         FROM quiz_attempts qa
         LEFT JOIN lessons l ON l.id = qa.lesson_id
        WHERE qa.user_id = ?
        GROUP BY qa.lesson_id, qa.module
       HAVING answered > 0
        ORDER BY (CAST(correct AS REAL) / answered) ASC, answered DESC`,
      [userId]
    );

    // Below this, practice is the recommendation. Above it, the lesson is not what
    // needs work.
    //
    // 0.85 rather than 0.8 so the near-miss is included: 5 of 6 is 0.833, and that
    // is exactly the case worth one more pass. A learner at 5 of 6 on a lesson
    // everything later builds on should see it; the old query called that "strong
    // performance" and gave them nothing to do. 5 of 5 and 6 of 7 stay out.
    const THRESHOLD = 0.85;

    const recommendations = rows.map((r) => {
      const accuracy = r.correct / r.answered;
      return {
        lessonId: r.lesson_id,
        module: r.module,
        // Falls back to the id when a lesson row is missing, rather than rendering
        // an empty string.
        title: r.title ?? r.lesson_id,
        attempts: r.attempts,
        answered: r.answered,
        correct: r.correct,
        accuracy: Number(accuracy.toFixed(3)),
        priority: accuracy < 0.5 ? 'high' : accuracy < THRESHOLD ? 'medium' : 'low',
        // Stated as the numbers behind it, so the learner can check the claim.
        reason: `${r.correct} of ${r.answered} correct across ${r.attempts} attempt${
          r.attempts === 1 ? '' : 's'
        }`,
      };
    });

    return c.json({
      data: {
        recommendations: recommendations.filter((r) => r.accuracy < THRESHOLD),
        // Kept separate rather than dropped: the UI says "nothing to practise" only
        // when there is genuinely no history, not when everything is above the line.
        solid: recommendations.filter((r) => r.accuracy >= THRESHOLD).length,
        lessonsAttempted: rows.length,
      },
    });
  } catch (error) {
    console.error('Suggested exercises error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/tutor/history — Get conversation history
tutorRoutes.get('/history', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

  try {
    const history = await db.query<Pick<TutorConversationsRow, 'user_message' | 'assistant_message' | 'created_at'>>(
      `SELECT user_message, assistant_message, created_at
       FROM tutor_conversations
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    return c.json({
      data: history.map((h) => ({
        userMessage: h.user_message,
        assistantMessage: h.assistant_message,
        createdAt: h.created_at,
      })),
    });
  } catch (error) {
    console.error('Tutor history error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ── Answering from data ─────────────────────────────────────────────────────
//
// Each branch renders records and cites them. None of it calls a model, which is
// both the F8 design ("the model only narrates it") and a practical necessity:
// Workers AI allows 10,000 neurons/day shared across all users, so anything
// model-dependent could not be load-bearing.
//
// Every branch has an explicit "the corpus does not have this" path. That is the
// point of the rewrite.

const ATTRIBUTION =
  '\n\n—\nFrom the Quranic Arabic Corpus (corpus.quran.com, GNU GPL) and the ' +
  'Tanzil text.';

async function answerFromData(
  db: Database,
  intent: Intent,
  ctx: { memorizationDue: number; weakAreas: string[] }
): Promise<string> {
  switch (intent.kind) {
    case 'word':
      return answerWord(db, intent.arabic);
    case 'root':
      return answerRoot(db, intent.root);
    case 'location':
      return answerLocation(db, intent.surah, intent.ayah);
    case 'tajweed':
      return answerTajweed(db, intent.rule);
    default: {
      const extra =
        ctx.memorizationDue > 0
          ? `\n\nYou also have ${ctx.memorizationDue} memorization unit${
              ctx.memorizationDue === 1 ? '' : 's'
            } due today.`
          : '';
      return CAPABILITIES_REPLY + extra;
    }
  }
}

/** A word the learner pasted. Matched on the normalised form. */
async function answerWord(db: Database, arabic: string): Promise<string> {
  const target = normaliseArabic(arabic);

  // Exact match first, which is an index hit. A first draft of this pulled
  // `LIMIT 20000` rows and filtered in JS — 20,000 of 77,429 words is roughly
  // the first eight surahs, so anything later was unfindable regardless of how
  // it was typed.
  type GlossRow = {
    surah_id: number; ayah_id: number; position: number; arabic: string; english: string;
  };
  let hit = await db.get<GlossRow>(
    `SELECT surah_id, ayah_id, position, arabic, english
     FROM quran_word_gloss WHERE arabic = ? LIMIT 1`,
    [arabic.trim()]
  );

  // Failing that, compare normalised forms — but bounded by first letter so this
  // stays a narrow scan rather than a table sweep.
  if (!hit && target.length >= 2) {
    const candidates = await db.query<GlossRow>(
      `SELECT surah_id, ayah_id, position, arabic, english
       FROM quran_word_gloss WHERE arabic LIKE ? LIMIT 800`,
      [`${arabic.trim()[0]}%`]
    );
    hit = candidates.find((g) => normaliseArabic(g.arabic) === target) ?? undefined;
  }

  if (!hit) {
    return (
      `I could not find **${arabic}** in the corpus as written.\n\n` +
      `That usually means a different vocalisation or an inflected form I am not ` +
      `matching, rather than the word being absent. Try pasting it exactly as it ` +
      `appears in the text, or give me a location like \`2:255\` and I will show ` +
      `every word in that ayah.`
    );
  }

  const morph = await db.query<MorphRow & { form: string | null; segment_index: number }>(
    `SELECT segment_index, form, lemma, root, pos, verb_form, aspect, voice,
            case_case, gender, number, person
     FROM quran_word_morphology
     WHERE surah_id = ? AND ayah_id = ? AND word_index = ?
     ORDER BY segment_index ASC`,
    [hit.surah_id, hit.ayah_id, hit.position]
  );

  const lines = [`**${hit.arabic}** — “${hit.english}”`, ''];
  if (morph.length === 0) {
    lines.push('The morphology corpus does not annotate this word.');
  }
  for (const seg of morph) {
    const facts = grammarFacts(seg);
    const shown = Object.entries(facts).filter(([, v]) => v);
    if (shown.length === 0) continue;
    lines.push(
      `*${seg.form ? buckwalterToArabic(seg.form) : `segment ${seg.segment_index}`}*`
    );
    for (const [k, v] of shown) {
      lines.push(`  • ${k.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${v}`);
    }
  }
  lines.push('', `Quran ${hit.surah_id}:${hit.ayah_id}, word ${hit.position}.`);
  return lines.join('\n') + ATTRIBUTION;
}

/** A root family. */
async function answerRoot(db: Database, root: string): Promise<string> {
  const rows = await db.query<MorphRow>(
    `SELECT lemma, root, pos, verb_form, aspect, voice, case_case, gender, number, person
     FROM quran_word_morphology WHERE root = ?`,
    [root]
  );
  if (rows.length === 0) {
    return (
      `The corpus has no occurrences of the root \`${root}\`.\n\n` +
      `Roots are written in Buckwalter here — \`ktb\` for كتب, \`Elm\` for ` +
      `علم. If you meant a different root, try that form.`
    );
  }

  const family = buildFamily(root, rows);
  const lines = [
    `**${family.rootArabic}** — ${family.totalOccurrences} occurrences.`,
    '',
  ];
  if (family.formsAttested.length) {
    lines.push(`Verb forms attested: ${family.formsAttested.map((f) => `Form ${f}`).join(', ')}.`);
    if (family.formsAttested.length === 1) {
      lines.push('Only one form, so there is no form contrast to drill on this root.');
    }
    lines.push('');
  }
  for (const m of family.members.slice(0, 10)) {
    lines.push(
      `• ${m.lemmaArabic} — ${m.pos ?? 'unclassified'}` +
        (m.form ? `, Form ${m.form}` : '') +
        ` (×${m.occurrences})`
    );
  }
  return lines.join('\n') + ATTRIBUTION;
}

/** An ayah, word by word. */
async function answerLocation(db: Database, surah: number, ayah: number): Promise<string> {
  const words = await db.query<{ position: number; arabic: string; english: string }>(
    `SELECT position, arabic, english FROM quran_word_gloss
     WHERE surah_id = ? AND ayah_id = ? ORDER BY position ASC`,
    [surah, ayah]
  );
  if (words.length === 0) {
    return `I have no words recorded for ${surah}:${ayah}. Check the reference — surahs run 1–114.`;
  }
  const verse = await db.get<{ text_uthmani: string }>(
    `SELECT text_uthmani FROM quran_verses WHERE surah = ? AND ayah = ?`,
    [surah, ayah]
  );

  const lines = [`**Quran ${surah}:${ayah}**`, ''];
  if (verse?.text_uthmani) lines.push(verse.text_uthmani, '');
  for (const w of words) lines.push(`• ${w.arabic} — ${w.english}`);
  return lines.join('\n') + ATTRIBUTION;
}

/** A tajweed rule, with real examples pulled from the annotated text. */
async function answerTajweed(db: Database, rule: string): Promise<string> {
  const meta = await db.get<{ name: string; color: string }>(
    `SELECT name, color FROM tajweed_rules WHERE id = ?`,
    [rule]
  );

  // Find ayahs whose stored tags include this category. The tags carry the
  // ingest's rule names, which map to display categories in tajweed-colors.ts.
  const verses = await db.query<{ surah: number; ayah: number; text_uthmani: string; tajweed_tags: string }>(
    `SELECT surah, ayah, text_uthmani, tajweed_tags FROM quran_verses
     WHERE tajweed_tags LIKE ? LIMIT 200`,
    [`%${rule === 'madd' ? 'madd' : rule === 'noon_saakin' ? 'ikhfa' : rule}%`]
  );

  const examples: string[] = [];
  for (const v of verses) {
    if (examples.length >= 4) break;
    examples.push(`• ${v.text_uthmani.slice(0, 60)}${v.text_uthmani.length > 60 ? '…' : ''} — ${v.surah}:${v.ayah}`);
  }

  if (examples.length === 0) {
    return (
      `I have no annotated examples of **${meta?.name ?? rule}** in the text.\n\n` +
      `Either the Quran text has not been ingested for this deployment, or that ` +
      `rule is not among the ones the annotation covers. I would rather tell you ` +
      `that than make an example up.`
    );
  }

  return (
    `**${meta?.name ?? rule}** — real occurrences from the annotated text:\n\n` +
    examples.join('\n') +
    `\n\nOpen the Tajweed reader to see these colour-coded in place.` +
    ATTRIBUTION
  );
}
