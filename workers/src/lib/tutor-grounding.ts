// Interpreting a tutor question so it can be answered from data.
//
// The tutor was a keyword matcher with hardcoded replies, and it invented Arabic.
// Its madd answer offered السَّآمَّة and الْحَآئِرِينَ as canonical examples;
// neither occurs anywhere in the Quran. Checked against the pinned text: 0
// occurrences each, while the real examples — الضَّآلِّينَ (6), السَّمَآء (118),
// جَآءَ (238) — sit in data the tutor never consulted.
//
// So this module does not generate prose. It decides what the question is ABOUT,
// and the route answers by rendering records. Per plan §F8: facts first, the model
// may narrate but is never the source. That also sidesteps the Workers AI ceiling
// of 10,000 neurons/day shared across all users — nothing here needs a model.
//
// When nothing can be grounded the honest answer is to say so and offer what the
// data does cover. A confident wrong answer is the failure mode being designed
// out.

/** Something the tutor can answer from a table. */
export type Intent =
  | { kind: 'word'; arabic: string }
  | { kind: 'root'; root: string }
  | { kind: 'location'; surah: number; ayah: number }
  | { kind: 'tajweed'; rule: string }
  | { kind: 'capabilities' };

const ARABIC_LETTER = /[ء-غف-ي]/;
const DIACRITIC_RANGES: Array<[number, number]> = [
  [0x0610, 0x061a],
  [0x064b, 0x065f],
  [0x06d6, 0x06ed],
];
const FOLD: Record<string, string> = {
  'ٱ': 'ا', // alef wasla  -> alef
  'أ': 'ا', // alef hamza above
  'إ': 'ا', // alef hamza below
  'آ': 'ا', // alef madda
  'ى': 'ي', // alef maksura -> yeh
};

/**
 * Strip diacritics and fold alef variants.
 *
 * Codepoint arithmetic rather than a character class: inline Arabic ranges have
 * repeatedly swallowed the letters themselves in this codebase, once normalising
 * every word to an empty string.
 */
export function normaliseArabic(input: string): string {
  let out = '';
  for (const ch of input ?? '') {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp === 0x0670 || cp === 0x0640) continue; // dagger alef, tatweel
    if (DIACRITIC_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi)) continue;
    out += FOLD[ch] ?? ch;
  }
  return out.replace(/ا+/g, 'ا').trim();
}

/** Tajweed rules the app actually holds data for, with the words users type. */
const TAJWEED_ALIASES: Record<string, string[]> = {
  madd: ['madd', 'مد', 'prolong', 'lengthen'],
  qalqalah: ['qalqalah', 'qalqala', 'قلقلة', 'echo', 'bounce'],
  ghunnah: ['ghunnah', 'ghunna', 'غنة', 'nasal'],
  noon_saakin: ['noon saakin', 'noon sakin', 'ikhfa', 'iqlab', 'idgham', 'idghaam', 'tanween', 'نون'],
  meem_saakin: ['meem saakin', 'meem sakin', 'shafawi', 'ميم'],
  hamzat_wasl: ['hamzat wasl', 'hamzatul wasl', 'همزة الوصل', 'wasl'],
  lam_shamsiyyah: ['lam shamsiyyah', 'sun letter', 'shamsiyyah', 'شمسية'],
};

const LOCATION = /(?:^|\s|:|surah\s*)(\d{1,3})\s*[:.]\s*(\d{1,3})\b/i;
/** A bare triliteral in Buckwalter, e.g. "ktb" — but not an English word. */
const BUCKWALTER_ROOT = /\broot\s+([A-Za-z*$&<>{}'`|]{2,5})\b/i;

/**
 * Work out what the question is about.
 *
 * Order matters: an explicit location or root beats a loose keyword, and Arabic
 * script in the message is the strongest signal of all — someone who pastes a
 * word wants that word explained.
 */
export function classify(message: string): Intent {
  const msg = (message ?? '').trim();
  if (!msg) return { kind: 'capabilities' };

  const loc = LOCATION.exec(msg);
  if (loc) {
    const surah = Number(loc[1]);
    const ayah = Number(loc[2]);
    if (surah >= 1 && surah <= 114 && ayah >= 1) {
      return { kind: 'location', surah, ayah };
    }
  }

  const rootMatch = BUCKWALTER_ROOT.exec(msg);
  if (rootMatch) return { kind: 'root', root: rootMatch[1] };

  // Arabic in the message: treat the longest run as the word being asked about.
  if (ARABIC_LETTER.test(msg)) {
    const runs = msg.match(/[؀-ۿݐ-ݿ]+/g) ?? [];
    const longest = runs.sort((a, b) => b.length - a.length)[0];
    if (longest && normaliseArabic(longest).length >= 2) {
      // A tajweed rule name written in Arabic is a rule question, not a word one.
      const lower = msg.toLowerCase();
      for (const [rule, aliases] of Object.entries(TAJWEED_ALIASES)) {
        if (aliases.some((a) => ARABIC_LETTER.test(a) && msg.includes(a))) {
          return { kind: 'tajweed', rule };
        }
        if (aliases.some((a) => !ARABIC_LETTER.test(a) && lower.includes(a))) {
          return { kind: 'tajweed', rule };
        }
      }
      return { kind: 'word', arabic: longest };
    }
  }

  const lower = msg.toLowerCase();
  for (const [rule, aliases] of Object.entries(TAJWEED_ALIASES)) {
    if (aliases.some((a) => !ARABIC_LETTER.test(a) && lower.includes(a))) {
      return { kind: 'tajweed', rule };
    }
  }

  return { kind: 'capabilities' };
}

/** Topics worth recording, derived from the intent rather than re-scanned. */
export function topicsFor(intent: Intent): string[] {
  switch (intent.kind) {
    case 'tajweed':
      return ['tajweed', intent.rule];
    case 'root':
      return ['morphology', 'root'];
    case 'word':
      return ['vocabulary'];
    case 'location':
      return ['reading'];
    default:
      return [];
  }
}

/**
 * What to say when nothing matches.
 *
 * Lists only what the app can actually answer from data. The previous fallback
 * offered generic study advice, which reads as helpful and tells the learner
 * nothing they could not have guessed.
 */
export const CAPABILITIES_REPLY = [
  'I answer from the Quranic corpus rather than from memory, so I can only tell you',
  'what the data records. That means:',
  '',
  '• **Paste an Arabic word** and I will give its root, lemma, part of speech, case',
  '  and verb form, citing where it occurs.',
  '• **Ask for a location** like `2:255` and I will show that ayah word by word',
  '  with each word\'s meaning.',
  '• **Ask about a root** like `root ktb` and I will show the whole family and which',
  '  derived forms are attested.',
  '• **Name a tajweed rule** — madd, qalqalah, ghunnah, ikhfa — and I will show real',
  '  examples from the text with their locations.',
  '',
  'If the corpus does not annotate something, I will say so rather than guess.',
].join('\n');
