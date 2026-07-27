/**
 * Which corpus-derived exercises are worth practising after a given lesson.
 *
 * ── Why this is a map and not a rule ────────────────────────────────────────
 *
 * The ten authored lessons carry 21 exercises between them — 2.1 each, against a gate
 * floor of 2. The derived bank next to them holds 4,950, every one traceable to a
 * corpus row. Connecting the two multiplies the practice available without adding a
 * line of hand-authored Arabic, which matters because hand-authored Arabic is how a
 * moon letter ended up in the sun-letter list.
 *
 * But the connection cannot be computed. The bank's seven kinds describe what the
 * MORPHOLOGY records — aspect, case, part of speech, verb form, root — and a lesson
 * teaches a topic. Some topics land exactly on a kind and some have no counterpart at
 * all, so this is editorial judgement, written down with its reasoning rather than
 * inferred from a title.
 *
 * Three lessons deliberately have NO practice: al- and Nouns, Nominal Sentences, and
 * Negation. Nothing in the corpus annotation marks definiteness, predication or
 * negation as such, and pointing those lessons at part-of-speech drills would be
 * practice that looks related and is not. An empty entry is the honest answer, and the
 * UI simply shows no practice link — the same call as leaving Husary without word
 * timings rather than guessing at them.
 */

/** The seven kinds the derived bank actually contains. */
export type PracticeKind =
  | 'aspect'
  | 'case_ending'
  | 'verb_form'
  | 'pos_id'
  | 'root_id'
  | 'word_meaning'
  | 'find_word';

export interface LessonPractice {
  kind: PracticeKind;
  /** Shown on the link, so the learner knows what they are about to drill. */
  label: string;
  /** Why this kind follows this lesson. Not shown; kept for whoever edits this next. */
  because: string;
}

export const LESSON_PRACTICE: Record<string, LessonPractice | null> = {
  // Definiteness is not annotated in the corpus. Part-of-speech drills would look
  // related and teach something else.
  'grammar-01': null,

  'grammar-02': {
    kind: 'aspect',
    label: 'Perfect or imperfect',
    because:
      'The lesson teaches the past tense; aspect is exactly the perfect/imperfect ' +
      'distinction the corpus records.',
  },

  // Predication — mubtada and khabar — has no corpus counterpart.
  'grammar-03': null,

  'grammar-04': {
    kind: 'aspect',
    label: 'Perfect or imperfect',
    because: 'Same distinction as the past-tense lesson, approached from the other side.',
  },

  'grammar-05': {
    kind: 'case_ending',
    label: "Case endings (i'rab)",
    because: 'An exact match: the lesson is i\'rab and the kind is the case the corpus records.',
  },

  'grammar-06': {
    kind: 'case_ending',
    label: 'Case endings in construct',
    because:
      'Idafa governs the genitive, so case-ending drills exercise the thing the lesson ' +
      'is about, even though the bank has no idafa-specific kind.',
  },

  'grammar-07': {
    kind: 'pos_id',
    label: 'Identify the part of speech',
    because:
      'Attached pronouns are tagged as pronouns in the corpus, so part-of-speech drills ' +
      'do exercise recognising them — moderately rather than exactly.',
  },

  'grammar-08': {
    kind: 'verb_form',
    label: 'Verb form (I–XII)',
    because: 'An exact match: the lesson teaches the derived forms and the kind asks for them.',
  },

  'grammar-09': {
    kind: 'pos_id',
    label: 'Identify the part of speech',
    because: 'Demonstratives carry their own POS tag, so identification drills reach them.',
  },

  // Negative particles are tagged, but "which particle negates this" is not a question
  // the bank asks, and pos_id would mostly serve nouns and verbs.
  'grammar-10': null,
};

/** The practice link target for a lesson, or null when there is nothing honest to offer. */
export function practiceHref(
  lessonId: string,
  level: number
): { href: string; label: string } | null {
  // Generated root lessons map exactly onto root identification — that is literally
  // what they teach — so they need no entry in the table above and adding sixty would
  // be noise. Handled by prefix rather than enumerated.
  if (lessonId.startsWith('root-')) {
    return { href: `/grammar?kind=root_id&level=${level}`, label: 'Identify the root' };
  }
  const entry = LESSON_PRACTICE[lessonId];
  if (!entry) return null;
  // The existing runner at /grammar already filters by kind and level, grades, and
  // records to grammar_mastery. Pointing at it beats building a second one.
  return {
    href: `/grammar?kind=${entry.kind}&level=${level}`,
    label: entry.label,
  };
}
