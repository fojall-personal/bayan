/**
 * Which corpus-derived exercises are worth practising after a given lesson.
 *
 * ── Why this is a map and not a rule ────────────────────────────────────────
 *
 * The ten authored lessons carry 21 exercises between them — 2.1 each, against a gate
 * floor of 2. The derived bank next to them is a 37,230-item graded bank, every one
 * traceable to a corpus row. Connecting the two multiplies the practice available without
 * adding a line of hand-authored Arabic, which matters because hand-authored Arabic is how
 * a moon letter ended up in the sun-letter list.
 *
 * But the connection cannot be computed. The bank's kinds describe what the MORPHOLOGY
 * records — aspect, case, part of speech, verb form, root — and a lesson teaches a topic.
 * Some topics land exactly on a kind and some have no counterpart at all, so this is
 * editorial judgement, written down with its reasoning rather than inferred from a title.
 *
 * Every one of the ten now has practice, and three of those entries began as null on the
 * belief that the corpus said nothing about definiteness, predication or negation. Two of
 * those beliefs were simply wrong — DET marks the article on 8,377 segments and NEG marks
 * 2,688 particles, and I had checked the `pos` column without ever looking at `tag`. The
 * third was right about predication and wrong about the lesson, which opens on a claim
 * about the first word rather than about مبتدأ and خبر.
 *
 * So the standard for filling one of these in is unchanged and worth restating: the drill
 * must ask something the annotation DECIDES. Pointing a lesson at a drill that merely
 * sounds related is practice that looks like teaching and is not, and an empty entry —
 * which renders as no practice link at all — stays the honest answer when that is the
 * situation. It is the same call as leaving Husary without word timings rather than
 * guessing at them.
 */

/** The kinds the derived bank actually contains. Checked against it by check-pedagogy. */
export type PracticeKind =
  | 'aspect'
  | 'case_ending'
  | 'verb_form'
  | 'pos_id'
  | 'root_id'
  | 'word_meaning'
  | 'find_word'
  | 'definiteness'
  | 'negation'
  | 'mood'
  | 'voice'
  | 'subject_agreement'
  | 'word_role'
  | 'relative_pronoun'
  | 'demonstrative'
  | 'conditional'
  | 'sentence_type'
  // From the treebank's syntax layer — what a word DOES, not what it is.
  | 'mubtada_khabar'
  | 'subject_word'
  | 'object'
  | 'idafa'
  | 'derived_noun'
  | 'fronting';

export interface LessonPractice {
  kind: PracticeKind;
  /** Shown on the link, so the learner knows what they are about to drill. */
  label: string;
  /** Why this kind follows this lesson. Not shown; kept for whoever edits this next. */
  because: string;
}

export const LESSON_PRACTICE: Record<string, LessonPractice | null> = {
  // Was null on the belief that definiteness is not annotated. It is: DET on 8,377 prefix
  // segments. I had checked the `pos` column and never looked at `tag`.
  'grammar-01': {
    kind: 'definiteness',
    label: 'Definite or indefinite',
    because:
      'The lesson teaches the article ال, and the corpus marks exactly that — a DET ' +
      'prefix segment, or INDEF on the stem.',
  },

  'grammar-02': {
    kind: 'aspect',
    label: 'Perfect or imperfect',
    because:
      'The lesson teaches the past tense; aspect is exactly the perfect/imperfect ' +
      'distinction the corpus records.',
  },

  // Predication IS annotated after all — just not in the corpus this app started from.
  //
  // This entry was null on the grounds that nothing marks مبتدأ and خبر, then became
  // sentence_type on the narrower ground that the opening word's part of speech is
  // recorded. Both were true of Kais Dukes' morphology v0.4. Neither is true of the field:
  // the Extended Quranic Treebank marks Pred on 4,399 tokens, and 2:2 resolves exactly as
  // a grammarian would — ذَٰلِكَ the مبتدأ, ٱلْكِتَٰبُ its بدل, هُدًى the خبر.
  //
  // So the lesson now drills the thing it is named after. sentence_type remains a good
  // kind and covers the lesson's opening claim; this covers its subject.
  'grammar-03': {
    kind: 'mubtada_khabar',
    label: 'Which word is the predicate (خبر)',
    because:
      'Exact. The lesson teaches مبتدأ + خبر and the treebank marks the خبر, cross-checked ' +
      'against the nominative case the morphology records independently — a question that ' +
      'was impossible here until a second source supplied the syntax.',
  },

  'grammar-04': {
    kind: 'mood',
    label: 'Mood (indicative / subjunctive / jussive)',
    because:
      'The present-tense lesson is where mood becomes visible — jussive and subjunctive ' +
      'only occur on imperfect verbs, governed by a preceding particle. Sharper than ' +
      'aspect here, which the past-tense lesson already drills.',
  },

  'grammar-05': {
    kind: 'case_ending',
    label: "Case endings (i'rab)",
    because: 'An exact match: the lesson is i\'rab and the kind is the case the corpus records.',
  },

  // Was case_ending, chosen because "the bank has no idafa-specific kind". It has one now:
  // Poss on 9,807 tokens, of which 3,312 also carry the genitive the morphology records.
  'grammar-06': {
    kind: 'idafa',
    label: 'Which word is the مضاف إليه',
    because:
      'Exact, where this used to settle for generic case endings. The treebank marks the ' +
      'إضافة relation itself, so the question is about the construction the lesson teaches ' +
      'rather than about the genitive it happens to cause.',
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
    kind: 'demonstrative',
    label: 'Which word is the demonstrative',
    because:
      'Exact now. DEM has its own drill, so this no longer has to settle for the generic ' +
      'part-of-speech question that merely happened to include demonstratives.',
  },

  // "Which particle negates this" is now a question the bank asks — 651 of them, from
  // the 2,688 NEG-tagged segments.
  'grammar-10': {
    kind: 'negation',
    label: 'Which word negates',
    because:
      'POS:NEG marks the particle, which is what the lesson teaches. The sentence-level ' +
      'reading is not annotated, so the drill asks about the particle only.',
  },
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
