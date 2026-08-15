/**
 * Band assignment, gate items, and the authored-lesson ceiling.
 *
 * One module. Every writer (onboarding, placement, calibration, advance,
 * 0029 backfill) calls these functions. There is no second table.
 */

export type Band = 'foundation' | 'ajurrumiyya' | 'qatr' | 'alfiyya' | 'irab';

export const BAND_ORDER: Band[] = [
  'foundation',
  'ajurrumiyya',
  'qatr',
  'alfiyya',
  'irab',
];

export type BandSource =
  | 'backfill'
  | 'onboarding'
  | 'placement'
  | 'calibration'
  | 'gate'
  | 'manual';

export const BAND_COPY: Record<
  Band,
  { compactLabel: string; bookTitle: string; bookSentence: string }
> = {
  foundation: {
    compactLabel: 'Script',
    bookTitle: 'Script',
    bookSentence: 'Before the nahw books. Letters, joining, the three short vowels.',
  },
  ajurrumiyya: {
    compactLabel: 'Ajurrūm',
    bookTitle: 'al-Ajurrūmiyya',
    bookSentence:
      'Jumlah ismiyya, the three cases, iḍāfa. Sun/moon and māḍī sit beside this book, they are not chapters of it.',
  },
  qatr: {
    compactLabel: 'Qaṭr',
    bookTitle: 'Qaṭr al-Nadā',
    bookSentence:
      'Next nahw book-equivalent: produced case endings, mood, particles. Nawāsikh are unauthored.',
  },
  alfiyya: {
    compactLabel: 'Alfiyya',
    bookTitle: 'Alfiyyat Ibn Mālik',
    bookSentence: 'Skill checklist: name the token ʿāmil, recover the elided fāʿil.',
  },
  irab: {
    compactLabel: 'Iʿrāb',
    bookTitle: 'Iʿrāb al-Qurʾān',
    bookSentence: 'Capstone: open an ayah you have not studied and parse it without help.',
  },
};

/** Lessons that belong to that book's sheet, not the full unlock stack. */
export const BOOK_LESSON_IDS: Record<Band, readonly string[]> = {
  foundation: ['literacy-01', 'literacy-02', 'literacy-03', 'literacy-04', 'grammar-01'],
  ajurrumiyya: ['grammar-01', 'grammar-02', 'grammar-03', 'grammar-05', 'grammar-06'],
  qatr: ['grammar-04', 'grammar-07', 'grammar-08', 'grammar-09', 'grammar-10', 'grammar-12'],
  alfiyya: ['grammar-11'],
  irab: [],
};

/** Authored grammar ids unlocked at each band. literacy-% is always allowed. */
export const BAND_GRAMMAR_IDS: Record<Band, readonly string[]> = {
  foundation: ['grammar-01'],
  ajurrumiyya: ['grammar-01', 'grammar-02', 'grammar-03', 'grammar-05', 'grammar-06'],
  qatr: [
    'grammar-01',
    'grammar-02',
    'grammar-03',
    'grammar-05',
    'grammar-06',
    'grammar-04',
    'grammar-07',
    'grammar-08',
    'grammar-09',
    'grammar-10',
    'grammar-12',
  ],
  alfiyya: [
    'grammar-01',
    'grammar-02',
    'grammar-03',
    'grammar-05',
    'grammar-06',
    'grammar-04',
    'grammar-07',
    'grammar-08',
    'grammar-09',
    'grammar-10',
    'grammar-12',
    'grammar-11',
  ],
  irab: [
    'grammar-01',
    'grammar-02',
    'grammar-03',
    'grammar-05',
    'grammar-06',
    'grammar-04',
    'grammar-07',
    'grammar-08',
    'grammar-09',
    'grammar-10',
    'grammar-12',
    'grammar-11',
  ],
};

export const PAIR_TARGET: Record<Band, number> = {
  foundation: 0,
  ajurrumiyya: 20,
  qatr: 50,
  alfiyya: 100,
  irab: 100,
};

export const ROOT_TARGET: Record<Band, number> = {
  foundation: 0,
  ajurrumiyya: 63,
  qatr: 200,
  alfiyya: 400,
  irab: 400,
};

export const FORMS_UNLOCKED: Record<Band, readonly string[]> = {
  foundation: [],
  ajurrumiyya: ['I'],
  qatr: ['I', 'II', 'III', 'IV'],
  alfiyya: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'],
  irab: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'],
};

export function isBand(value: unknown): value is Band {
  return (
    value === 'foundation' ||
    value === 'ajurrumiyya' ||
    value === 'qatr' ||
    value === 'alfiyya' ||
    value === 'irab'
  );
}

export function nextBand(band: Band): Band | null {
  const i = BAND_ORDER.indexOf(band);
  if (i < 0 || i >= BAND_ORDER.length - 1) return null;
  return BAND_ORDER[i + 1];
}

export function lessonAllowedForBand(id: string, band: Band | null): boolean {
  if (id.startsWith('literacy-')) return true;
  if (!id.startsWith('grammar-')) return false;
  if (!band) return true;
  if (!/^grammar-\d+$/.test(id)) return true;
  return BAND_GRAMMAR_IDS[band].includes(id);
}

export function assignBand(input: {
  source: 'backfill' | 'onboarding' | 'placement';
  currentPath?: 'path1' | 'path2' | 'path3' | string;
  readingAbility?: 'no' | 'partial' | 'yes' | string;
  scores?: {
    literacy: number;
    comprehension: number;
    grammar: number;
    memorization: number;
  };
  rootsKnown: number;
}): Band {
  if (input.source === 'backfill') {
    if (input.currentPath === 'path3') return 'qatr';
    if (input.currentPath === 'path2') return 'ajurrumiyya';
    return input.rootsKnown === 0 ? 'foundation' : 'ajurrumiyya';
  }
  if (input.source === 'onboarding') {
    return input.readingAbility === 'no' ? 'foundation' : 'ajurrumiyya';
  }
  const s = input.scores!;
  const weakest = Math.min(s.literacy, s.comprehension, s.grammar, s.memorization);
  const composite =
    s.literacy * 0.2 + s.comprehension * 0.3 + s.grammar * 0.25 + s.memorization * 0.25;
  if (s.literacy < 60) return 'foundation';
  if (weakest < 40) return 'ajurrumiyya';
  if (composite >= 70 && weakest >= 60) return 'alfiyya';
  return 'qatr';
}

/** Calibration never promotes. It may lower qatr/alfiyya to ajurrumiyya. */
export function bandAfterCalibration(current: Band, rootsKnown: number): Band {
  if ((current === 'qatr' || current === 'alfiyya') && rootsKnown === 0) {
    return 'ajurrumiyya';
  }
  return current;
}

export interface GateItem {
  id: string;
  label: string;
  current: number;
  target: number;
  met: boolean;
  deferred: boolean;
}

export function rollingAccuracy(
  rows: { correct: number }[],
  n: number
): { current: number; met: boolean } {
  if (rows.length < n) return { current: rows.length, met: false };
  const window = rows.slice(-n);
  const pct = window.filter((r) => r.correct === 1).length / n;
  return { current: Math.round(pct * 100), met: pct >= 0.7 };
}

/** Sole definition of gate.ready. Empty blocking set (all deferred, or irab []) is false. */
export function gateReady(items: GateItem[]): boolean {
  const blocking = items.filter((i) => !i.deferred);
  return blocking.length > 0 && blocking.every((i) => i.met);
}

function done(lessonIds: string[], completedOrSkipped: Set<string>): GateItem {
  const current = lessonIds.filter((id) => completedOrSkipped.has(id)).length;
  return {
    id: 'authored',
    label: 'Authored lessons',
    current,
    target: lessonIds.length,
    met: current === lessonIds.length,
    deferred: false,
  };
}

export function gateItems(
  band: Band,
  ctx: {
    completedOrSkipped: Set<string>;
    literacyLessonIds: string[];
    rootsKnown: number;
    topPairKnown: number;
    pairTarget: number;
    accuracy: Record<string, { current: number; met: boolean }>;
    patternsKnown: Set<string>;
    assessmentLiteracy?: number | null;
    scriptQuizPct?: number | null;
    governorKindExists: boolean;
    homographKindExists: boolean;
    tashkilPersisted: boolean;
  }
): GateItem[] {
  if (band === 'foundation') {
    const hasLiteracy = ctx.literacyLessonIds.length > 0;
    const lit = hasLiteracy
      ? done(ctx.literacyLessonIds, ctx.completedOrSkipped)
      : {
          id: 'literacy_lessons',
          label: 'Literacy lessons',
          current: 0,
          target: 0,
          met: false,
          deferred: true,
        };
    const quiz = {
      id: 'script_quiz',
      label: 'Script check',
      current: ctx.scriptQuizPct ?? (ctx.assessmentLiteracy ?? 0),
      target: 70,
      met: (ctx.scriptQuizPct ?? 0) >= 70 || (ctx.assessmentLiteracy ?? 0) >= 60,
      deferred: ctx.scriptQuizPct == null && ctx.assessmentLiteracy == null,
    };
    return [lit, quiz];
  }
  if (band === 'ajurrumiyya') {
    return [
      done([...BOOK_LESSON_IDS.ajurrumiyya], ctx.completedOrSkipped),
      {
        id: 'roots',
        label: 'Roots',
        current: ctx.rootsKnown,
        target: 63,
        met: ctx.rootsKnown >= 63,
        deferred: false,
      },
      {
        id: 'pairs',
        label: 'Function-word pairs',
        current: ctx.topPairKnown,
        target: 20,
        met: ctx.topPairKnown >= 20,
        deferred: false,
      },
      {
        id: 'nahw_mc',
        label: 'pos / sentence / case',
        current: ctx.accuracy.nahw_mc?.current ?? 0,
        target: 70,
        met: ctx.accuracy.nahw_mc?.met ?? false,
        deferred: false,
      },
    ];
  }
  if (band === 'qatr') {
    return [
      done([...BOOK_LESSON_IDS.qatr], ctx.completedOrSkipped),
      {
        id: 'roots',
        label: 'Roots',
        current: ctx.rootsKnown,
        target: 200,
        met: ctx.rootsKnown >= 200,
        deferred: false,
      },
      {
        id: 'pairs',
        label: 'Function-word pairs',
        current: ctx.topPairKnown,
        target: 50,
        met: ctx.topPairKnown >= 50,
        deferred: false,
      },
      {
        id: 'qatr_mc',
        label: 'negation / demonstrative / mood / idafa',
        current: ctx.accuracy.qatr_mc?.current ?? 0,
        target: 70,
        met: ctx.accuracy.qatr_mc?.met ?? false,
        deferred: false,
      },
      {
        id: 'tashkil',
        label: 'Tashkil',
        current: ctx.accuracy.tashkil?.current ?? 0,
        target: 70,
        met: ctx.accuracy.tashkil?.met ?? false,
        deferred: !ctx.tashkilPersisted,
      },
    ];
  }
  if (band === 'alfiyya') {
    const forms = ['II', 'III', 'IV', 'V', 'VIII', 'X'];
    const formCount = forms.filter((f) => ctx.patternsKnown.has(f)).length;
    return [
      done([...BOOK_LESSON_IDS.alfiyya], ctx.completedOrSkipped),
      {
        id: 'elided',
        label: 'Elided فاعل',
        current: ctx.accuracy.elided_subject?.current ?? 0,
        target: 70,
        met: ctx.accuracy.elided_subject?.met ?? false,
        deferred: false,
      },
      {
        id: 'homograph',
        label: 'Homograph',
        current: ctx.accuracy.homograph?.current ?? 0,
        target: 70,
        met: ctx.accuracy.homograph?.met ?? false,
        deferred: !ctx.homographKindExists,
      },
      {
        id: 'roles',
        label: 'fāʿil / mafʿūl / khabar',
        current: ctx.accuracy.roles?.current ?? 0,
        target: 70,
        met: ctx.accuracy.roles?.met ?? false,
        deferred: false,
      },
      {
        id: 'forms',
        label: 'Forms II–X core',
        current: formCount,
        target: 6,
        met: formCount === 6,
        deferred: false,
      },
      {
        id: 'governor',
        label: 'Name the ʿāmil',
        current: ctx.accuracy.governor?.current ?? 0,
        target: 70,
        met: ctx.accuracy.governor?.met ?? false,
        deferred: !ctx.governorKindExists,
      },
    ];
  }
  return [];
}

export const NAHW_MC_KINDS = ['pos_id', 'sentence_type', 'case_ending'] as const;
export const QATR_MC_KINDS = ['negation', 'demonstrative', 'mood', 'idafa'] as const;
export const ROLES_KINDS = ['subject_word', 'object', 'mubtada_khabar'] as const;

export const LESSON_EYEBROW: Record<string, string> = {
  'grammar-01': 'Nahw · definite article',
  'grammar-02': 'Bināʾ al-Afʿāl · ṣarf · 1 of 1 in this band',
  'grammar-03': 'Ajurrūmiyya · nahw · 1 of 3',
  'grammar-04': 'Shadhā al-ʿArf · ṣarf',
  'grammar-05': 'Ajurrūmiyya · nahw · 2 of 3',
  'grammar-06': 'Ajurrūmiyya · nahw · 3 of 3',
  'grammar-07': 'Nahw',
  'grammar-08': 'Shadhā al-ʿArf · ṣarf',
  'grammar-09': 'Nahw',
  'grammar-10': 'Nahw',
  'grammar-11': 'al-Balāgha al-Wāḍiḥa · balāgha',
  'grammar-12': 'Qaṭr · nawāsikh',
};

export const LESSON_COMPLETE_COPY: Record<string, string> = {
  'grammar-02': 'Māḍī conjugation — this is the Bināʾ al-Afʿāl chapter.',
  'grammar-03': 'The nominal sentence — this is the جملة اسمية chapter of the Ajurrūmiyya.',
  'grammar-05': 'The three cases — Ajurrūmiyya iʿrāb.',
  'grammar-06': 'Iḍāfa — Ajurrūmiyya majrūrāt.',
};

/**
 * Grade a typed root from the letter pad.
 *
 * The pad never inserts spaces. A keyboard fallback may. Spaces are stripped
 * before normalizeArabic so اله and ا ل ه match. normalizeArabic itself is
 * unchanged: it keeps a single space, so الكتاب ≠ كتاب still holds.
 */
export function gradeTypedRoot(
  given: string,
  expected: string,
  normalize: (s: string) => string
): boolean {
  const strip = (s: string) => s.replace(/\s+/g, '');
  return normalize(strip(given)).toLowerCase() === normalize(strip(expected)).toLowerCase();
}
