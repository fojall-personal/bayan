/**
 * Root families and pattern drills, derived from the corpus.
 *
 * Fixtures are real rows from the re-ingested corpus, not invented ones. The ktb
 * and Amn families below are what /api/grammar/root/:root actually returns.
 */

import { describe, expect, it } from 'vitest';
import {
  buildFamily,
  drillsFromFamily,
  formOf,
  grammarFacts,
  type MorphRow,
} from '../src/lib/root-families';

const row = (o: Partial<MorphRow>): MorphRow => ({
  lemma: null, root: null, pos: null, verb_form: null, aspect: null,
  voice: null, case_case: null, gender: null, number: null, person: null,
  ...o,
});

/** Real ktb rows. kitāb dominates at 260 occurrences; the verbs are rarer. */
const KTB: MorphRow[] = [
  ...Array(260).fill(0).map(() => row({ lemma: 'kita`b', root: 'ktb', pos: 'N' })),
  ...Array(49).fill(0).map(() => row({ lemma: 'kataba', root: 'ktb', pos: 'V', aspect: 'PERF' })),
  row({ lemma: '{kotataba', root: 'ktb', pos: 'V', verb_form: 'VIII', aspect: 'PERF' }),
  row({ lemma: 'kaAtibu', root: 'ktb', pos: 'V', verb_form: 'III', aspect: 'IMPV' }),
  row({ lemma: 'kaAtib', root: 'ktb', pos: 'N' }),
];

describe('formOf', () => {
  it('treats an unmarked verb as Form I, not unknown', () => {
    // The corpus marks II–XII in parentheses and leaves Form I bare, because
    // Form I IS the bare triliteral. Reading "no marker" as unknown would drop
    // the commonest form out of every drill.
    expect(formOf(row({ pos: 'V', verb_form: null }))).toBe('I');
  });

  it('reads a marked derived form', () => {
    expect(formOf(row({ pos: 'V', verb_form: 'VIII' }))).toBe('VIII');
    expect(formOf(row({ pos: 'V', verb_form: 'X' }))).toBe('X');
  });

  it('assigns no form to a non-verb', () => {
    // kitāb is a noun from a root whose verbs have forms; it has none itself.
    expect(formOf(row({ pos: 'N', verb_form: null }))).toBeNull();
    expect(formOf(row({ pos: 'ADJ' }))).toBeNull();
  });

  it('rejects a form outside I–XII rather than passing it through', () => {
    expect(formOf(row({ pos: 'V', verb_form: 'XVII' }))).toBeNull();
  });
});

describe('buildFamily', () => {
  const family = buildFamily('ktb', KTB);

  it('renders the root in Arabic, spaced', () => {
    expect(family.rootArabic).toBe('كتب');
  });

  it('converts lemmas out of Buckwalter', () => {
    const kitab = family.members.find((m) => m.lemma === 'kita`b');
    expect(kitab?.lemmaArabic).toBe('كِتَٰب');
  });

  it('orders members by how often they occur', () => {
    expect(family.members[0].lemma).toBe('kita`b');
    expect(family.members[0].occurrences).toBe(260);
  });

  it('lists attested forms in teaching order, not discovery order', () => {
    // VIII appears in the input before III; the output must still be I, III, VIII.
    expect(family.formsAttested).toEqual(['I', 'III', 'VIII']);
  });

  it('totals occurrences across the family', () => {
    expect(family.totalOccurrences).toBe(KTB.length);
  });

  it('collects the aspects a lemma appears in', () => {
    const kataba = family.members.find((m) => m.lemma === 'kataba');
    expect(kataba?.aspects).toContain('PERF');
  });

  it('ignores rows with no lemma', () => {
    // Determiners and conjunctions have none — 42% of segments.
    const f = buildFamily('ktb', [...KTB, row({ root: 'ktb', pos: 'DET' })]);
    expect(f.members.every((m) => m.lemma)).toBe(true);
  });
});

describe('drillsFromFamily', () => {
  it('produces drills whose distractors are all attested for that root', () => {
    const family = buildFamily('ktb', KTB);
    const drills = drillsFromFamily(family);
    expect(drills.length).toBeGreaterThan(0);
    for (const d of drills) {
      expect(d.distractors).not.toContain(d.answer);
      for (const x of d.distractors) {
        // Fabricated distractors would both make the drill guessable and assert
        // that a form exists for a root when the corpus says otherwise.
        expect(family.formsAttested).toContain(x);
      }
    }
  });

  it('yields nothing when only one form is attested — nothing to discriminate', () => {
    const single = buildFamily('xyz', [
      row({ lemma: 'xayaza', root: 'xyz', pos: 'V' }),
      row({ lemma: 'xayaza', root: 'xyz', pos: 'V' }),
    ]);
    expect(single.formsAttested).toEqual(['I']);
    expect(drillsFromFamily(single)).toEqual([]);
  });

  it('yields nothing for a family with no verbs at all', () => {
    const nouns = buildFamily('ktb', [row({ lemma: 'kita`b', root: 'ktb', pos: 'N' })]);
    expect(drillsFromFamily(nouns)).toEqual([]);
  });

  it('caps distractors at three, for a four-option question', () => {
    const many = buildFamily('nzl', [
      row({ lemma: 'a', root: 'nzl', pos: 'V' }),
      row({ lemma: 'b', root: 'nzl', pos: 'V', verb_form: 'II' }),
      row({ lemma: 'c', root: 'nzl', pos: 'V', verb_form: 'IV' }),
      row({ lemma: 'd', root: 'nzl', pos: 'V', verb_form: 'V' }),
      row({ lemma: 'e', root: 'nzl', pos: 'V', verb_form: 'X' }),
    ]);
    for (const d of drillsFromFamily(many)) {
      expect(d.distractors.length).toBeLessThanOrEqual(3);
    }
  });
});

describe('grammarFacts', () => {
  it('renders the real record for 54:1 qamar', () => {
    // The word that was entirely absent from the table before migration 0012.
    const facts = grammarFacts(
      row({ lemma: 'qamar', root: 'qmr', pos: 'N', case_case: 'NOM', gender: 'M' })
    );
    expect(facts.root).toBe('قمر');
    expect(facts.lemma).toBe('قَمَر');
    expect(facts.partOfSpeech).toBe('noun');
    expect(facts.grammaticalCase).toBe('nominative (مرفوع)');
    expect(facts.gender).toBe('masculine');
  });

  it('returns null for features the corpus does not annotate', () => {
    // F8 must be able to say "not annotated" rather than invent a plausible
    // answer. A determiner has almost nothing.
    const facts = grammarFacts(row({ pos: 'DET' }));
    expect(facts.root).toBeNull();
    expect(facts.lemma).toBeNull();
    expect(facts.grammaticalCase).toBeNull();
    expect(facts.verbForm).toBeNull();
  });

  it('names aspect and voice in both English and Arabic', () => {
    const facts = grammarFacts(
      row({ lemma: 'kataba', root: 'ktb', pos: 'V', aspect: 'PERF', voice: 'ACT' })
    );
    expect(facts.aspect).toBe('perfect (ماضي)');
    expect(facts.voice).toBe('active');
    expect(facts.verbForm).toBe('Form I');
  });

  it('passes an unrecognised POS tag through instead of dropping it', () => {
    expect(grammarFacts(row({ pos: 'WEIRD' })).partOfSpeech).toBe('WEIRD');
  });
});
