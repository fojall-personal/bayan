// Arabic Grammar Deep-Dive Parser
// Basic sentence analysis for nahw (syntax), sarf (morphology), balagha (rhetoric)

export interface ParsedWord {
  text: string;
  type: 'noun' | 'verb' | 'particle' | 'pronoun' | 'adjective' | 'preposition';
  case?: 'nominative' | 'accusative' | 'genitive';
  gender?: 'masculine' | 'feminine';
  number?: 'singular' | 'dual' | 'plural';
  person?: 'first' | 'second' | 'third';
  tense?: 'past' | 'present' | 'imperative';
  definition?: string;
}

export interface ParsedSentence {
  words: ParsedWord[];
  structure: string;
  subject?: ParsedWord;
  predicate?: ParsedWord;
  object?: ParsedWord;
}

export interface GrammarError {
  type: string;
  position: number;
  word: string;
  message: string;
  suggestion: string;
}

// The hand-authored Form I past-tense table lived here and served
// GET /api/grammar/conjugations. Both are gone: it covered five roots typed by
// hand, where quran_word_morphology carries 8,977 attested verb forms with their
// aspect, voice and person already annotated. Hand-authored Arabic is the same
// source that put a moon letter in the sun-letter list, and the corpus does not
// have opinions.

// Particles (حروف)
const PARTICLES = [
  'إن', 'أن', 'كان', 'كانت', 'كانا', 'كانوا', 'كن',
  'إذا', 'حتى', 'من', 'عن', 'إلى', 'في', 'على', 'ب', 'لـ', 'كـ',
  'قد', 'لعل', 'كأن', 'ليس', 'لا', 'هل', 'أ',
];

// Pronouns (ضمائر)
const PRONOUNS = [
  'هو', 'هي', 'هما', 'هم', 'هنّ',
  'أنتَ', 'أنتِ', 'أنتم', 'أنتنّ',
  'أنا', 'نحن', 'إياك', 'إياها', 'إياهم', 'إيانا',
];

// Common nouns with gender
const GENDERED_NOUNS: Record<string, 'masculine' | 'feminine'> = {
  'كتاب': 'masculine',
  'قلم': 'masculine',
  'بيت': 'masculine',
  'باب': 'masculine',
  'ولد': 'masculine',
  'رجل': 'masculine',
  'امرأة': 'feminine',
  ' بنت': 'feminine',
  'شمس': 'feminine',
  'قمر': 'masculine',
  'دار': 'feminine',
  'مدينة': 'feminine',
  'ساعة': 'feminine',
  'يد': 'feminine',
  'عين': 'feminine',
  'قلب': 'masculine',
  'نور': 'masculine',
  'ظلام': 'masculine',
  'علم': 'masculine',
  'لغة': 'feminine',
};

export function parseArabicSentence(sentence: string): ParsedSentence {
  const words = sentence.trim().split(/\s+/).filter(Boolean);
  const parsed: ParsedWord[] = [];
  let subject: ParsedWord | undefined;
  let predicate: ParsedWord | undefined;
  let object: ParsedWord | undefined;

  words.forEach((word, index) => {
    const parsedWord = parseSingleWord(word, index);
    parsed.push(parsedWord);

    if (parsedWord.type === 'verb' && !predicate) {
      predicate = parsedWord;
    } else if (
      (parsedWord.type === 'noun' || parsedWord.type === 'pronoun') &&
      !subject &&
      !predicate
    ) {
      subject = parsedWord;
    } else if (
      parsedWord.type === 'noun' &&
      predicate &&
      !object
    ) {
      object = parsedWord;
    }
  });

  let structure = 'unknown';
  if (predicate && subject && object) structure = 'VSO';
  else if (predicate && subject) structure = 'VS';
  else if (subject) structure = 'S...';
  else if (predicate) structure = 'V...';

  return { words: parsed, structure, subject, predicate, object };
}

function parseSingleWord(word: string, index: number): ParsedWord {
  let type: ParsedWord['type'] = 'noun';
  let tense: ParsedWord['tense'] | undefined;
  let gender: ParsedWord['gender'] | undefined;

  if (PRONOUNS.includes(word)) {
    type = 'pronoun';
  } else if (PARTICLES.some((p) => word.includes(p) || p.includes(word))) {
    type = 'particle';
  } else if (isPreposition(word)) {
    type = 'preposition';
  } else if (isVerb(word)) {
    type = 'verb';
    tense = detectTense(word);
  } else if (isAdjective(word)) {
    type = 'adjective';
  } else {
    // Check gender from known nouns
    gender = GENDERED_NOUNS[word];
  }

  return { text: word, type, tense, gender, definition: getWordDefinition(word) };
}

function isVerb(word: string): boolean {
  // He wrote/read/etc. (past tense Form I)
  if (/^[كقذج]ت[بَ]/.test(word) && word.length <= 4) return true;
  // He goes/says (present tense)
  if (/^[يأ]ق[وو]/.test(word) && word.length <= 5) return true;
  // She wrote/read (feminine past)
  if (/^[كقذج]ت[بَت]/.test(word) && word.length <= 5) return true;
  // They wrote (dual/plural)
  if (/^[كقذج]ت[ب]و/.test(word) && word.length <= 5) return true;
  // I wrote
  if (/^[كقذج]ت[ب]ت/.test(word) && word.length <= 4) return true;
  // We wrote
  if (/^[كقذج]ت[ب]نا/.test(word) && word.length <= 5) return true;
  return false;
}

function detectTense(word: string): 'past' | 'present' | 'imperative' {
  if (word.startsWith('ي') || word.startsWith('أ')) return 'present';
  if (word.endsWith('ْ')) return 'imperative';
  return 'past';
}

function isPreposition(word: string): boolean {
  return ['في', 'من', 'إلى', 'على', 'عن', 'ب', 'لـ', 'كـ'].includes(word);
}

function isAdjective(word: string): boolean {
  // He is big/good/happy (كان + adjective pattern)
  if (/^[ك]ان[ت]/.test(word)) return false; // was already handled as verb
  const adjectives = ['كبير', ' صغير', 'جديد', ' قديم', 'جميل', ' كبير', 'حسن', 'سيء'];
  return adjectives.includes(word);
}

function getWordDefinition(word: string): string | undefined {
  const definitions: Record<string, string> = {
    كتب: 'he wrote',
    قرأ: 'he read',
    ذهب: 'he went',
    جلس: 'he sat',
    كان: 'he was',
    يقول: 'he says',
    كتاب: 'book',
    قلم: 'pen',
    بيت: 'house',
    باب: 'door',
    ولد: 'boy',
    رجل: 'man',
    امرأة: 'woman',
    بنت: 'girl',
    شمس: 'sun',
    قمر: 'moon',
    دار: 'house (f.)',
    مدينة: 'city',
    لغة: 'language',
    علم: 'knowledge',
    نور: 'light',
    قلب: 'heart',
  };
  return definitions[word] || undefined;
}

export function checkGrammarErrors(sentence: string, parsed: ParsedSentence): GrammarError[] {
  const errors: GrammarError[] = [];

  // Check for missing subject with present tense verb
  if (parsed.predicate?.tense === 'present' && !parsed.subject) {
    errors.push({
      type: 'missing_subject',
      position: 0,
      word: parsed.predicate.text,
      message: 'Present tense verb usually requires a subject',
      suggestion: 'Add a subject pronoun or noun',
    });
  }

  // Check gender agreement (basic)
  if (parsed.subject?.gender === 'feminine' && parsed.predicate?.tense === 'past') {
    if (!parsed.predicate.text.endsWith('ت')) {
      errors.push({
        type: 'gender_agreement',
        position: parsed.predicate.text.length,
        word: parsed.predicate.text,
        message: 'Verb does not agree in gender with feminine subject',
        suggestion: 'Add ت to the verb for feminine subject (e.g., كَتَبَتْ)',
      });
    }
  }

  return errors;
}
