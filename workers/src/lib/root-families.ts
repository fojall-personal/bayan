// Root families, derived from the corpus rather than authored.
//
// This is the substrate for F8 (grounded explanations: render the record, do not
// invent it) and F9 (pattern drills: given a root, recognise the derived form).
//
// It only became possible once the morphology re-ingest kept segments instead of
// words — before that 40% of rows were missing and roots sat at 32,749 rather
// than 49,968, with `qmr` absent entirely.

import { buckwalterToArabic, rootToArabic } from './buckwalter';

/** Derived verb forms, in the order they are taught. */
export const VERB_FORMS = [
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII',
] as const;
export type VerbForm = (typeof VERB_FORMS)[number];

export interface MorphRow {
  lemma: string | null;
  root: string | null;
  pos: string | null;
  verb_form: string | null;
  aspect: string | null;
  voice: string | null;
  case_case: string | null;
  gender: string | null;
  number: string | null;
  person: string | null;
}

export interface FamilyMember {
  lemma: string;
  lemmaArabic: string;
  pos: string | null;
  form: VerbForm | null;
  aspects: string[];
  occurrences: number;
}

export interface RootFamily {
  root: string;
  rootArabic: string | null;
  members: FamilyMember[];
  /** Distinct verb forms attested for this root, in teaching order. */
  formsAttested: VerbForm[];
  totalOccurrences: number;
}

/**
 * The corpus marks derived forms II–XII in parentheses and leaves Form I
 * unmarked, because Form I *is* the bare triliteral. So a verb with no marker is
 * Form I — not "unknown". Treating it as unknown would drop the single most
 * common form from every drill.
 */
export function formOf(row: MorphRow): VerbForm | null {
  if (row.pos !== 'V') return null;
  const raw = row.verb_form;
  if (!raw) return 'I';
  return (VERB_FORMS as readonly string[]).includes(raw) ? (raw as VerbForm) : null;
}

/** Group rows sharing a root into one family. */
export function buildFamily(root: string, rows: MorphRow[]): RootFamily {
  const byLemma = new Map<string, FamilyMember>();

  for (const row of rows) {
    if (!row.lemma) continue;
    const form = formOf(row);
    const key = `${row.lemma}|${row.pos ?? ''}|${form ?? ''}`;
    let member = byLemma.get(key);
    if (!member) {
      member = {
        lemma: row.lemma,
        lemmaArabic: buckwalterToArabic(row.lemma),
        pos: row.pos,
        form,
        aspects: [],
        occurrences: 0,
      };
      byLemma.set(key, member);
    }
    member.occurrences++;
    if (row.aspect && !member.aspects.includes(row.aspect)) {
      member.aspects.push(row.aspect);
    }
  }

  const members = [...byLemma.values()].sort(
    (a, b) => b.occurrences - a.occurrences || a.lemma.localeCompare(b.lemma)
  );

  const attested = new Set<VerbForm>();
  for (const m of members) if (m.form) attested.add(m.form);

  return {
    root,
    rootArabic: rootToArabic(root),
    members,
    formsAttested: VERB_FORMS.filter((f) => attested.has(f)),
    totalOccurrences: members.reduce((n, m) => n + m.occurrences, 0),
  };
}

export interface FormDrill {
  root: string;
  rootArabic: string | null;
  /** The word the learner is shown. */
  lemma: string;
  lemmaArabic: string;
  answer: VerbForm;
  /** Wrong answers, all attested for THIS root so the drill is not guessable. */
  distractors: VerbForm[];
}

/**
 * Build "which form is this?" drills from a family.
 *
 * Distractors are drawn from forms actually attested for the same root. Random
 * forms would make the drill answerable by elimination — a learner would notice
 * that the plausible-looking option is always right — and would also assert that
 * a form exists for a root when the corpus says otherwise.
 *
 * A root with only one attested form yields no drill. That is the honest outcome:
 * there is nothing to discriminate.
 */
export function drillsFromFamily(family: RootFamily): FormDrill[] {
  if (family.formsAttested.length < 2) return [];

  const drills: FormDrill[] = [];
  for (const member of family.members) {
    if (!member.form) continue;
    const distractors = family.formsAttested.filter((f) => f !== member.form);
    if (distractors.length === 0) continue;
    drills.push({
      root: family.root,
      rootArabic: family.rootArabic,
      lemma: member.lemma,
      lemmaArabic: member.lemmaArabic,
      answer: member.form,
      distractors: distractors.slice(0, 3),
    });
  }
  return drills;
}

/**
 * The grounded i'rab record for one word — F8's "facts first".
 *
 * Returns only what the corpus states. Absent features come back as null rather
 * than being guessed, so the caller can say "the corpus does not annotate this"
 * instead of inventing a plausible answer. Per plan §F8 the model may narrate
 * this; it must never be the source of it.
 */
export function grammarFacts(row: MorphRow): Record<string, string | null> {
  const POS_NAMES: Record<string, string> = {
    N: 'noun', V: 'verb', ADJ: 'adjective', PN: 'proper noun', P: 'preposition',
    PRON: 'pronoun', DET: 'determiner', CONJ: 'conjunction', REL: 'relative pronoun',
    ACC: 'accusative particle', NEG: 'negative particle', INTG: 'interrogative',
    DEM: 'demonstrative', SUB: 'subordinating conjunction', RES: 'restriction particle',
  };
  const CASE_NAMES: Record<string, string> = {
    NOM: 'nominative (مرفوع)', ACC: 'accusative (منصوب)', GEN: 'genitive (مجرور)',
  };
  const ASPECT_NAMES: Record<string, string> = {
    PERF: 'perfect (ماضي)', IMPF: 'imperfect (مضارع)', IMPV: 'imperative (أمر)',
  };

  const form = formOf(row);
  return {
    root: rootToArabic(row.root),
    lemma: row.lemma ? buckwalterToArabic(row.lemma) : null,
    partOfSpeech: row.pos ? (POS_NAMES[row.pos] ?? row.pos) : null,
    verbForm: form ? `Form ${form}` : null,
    aspect: row.aspect ? (ASPECT_NAMES[row.aspect] ?? row.aspect) : null,
    voice: row.voice === 'PASS' ? 'passive' : row.voice === 'ACT' ? 'active' : null,
    grammaticalCase: row.case_case ? (CASE_NAMES[row.case_case] ?? row.case_case) : null,
    gender: row.gender === 'M' ? 'masculine' : row.gender === 'F' ? 'feminine' : null,
    number:
      row.number === 'S' ? 'singular' :
      row.number === 'D' ? 'dual' :
      row.number === 'P' ? 'plural' : null,
    person: row.person ? `${row.person}${row.person === '1' ? 'st' : row.person === '2' ? 'nd' : 'rd'} person` : null,
  };
}
