// Maps the tajweed annotation rule names to the display categories that carry
// a colour.
//
// Why a mapping is needed: the ingested annotations use 18 distinct rule names
// (scripts/ingest-quran.mjs, from cpfair/quran-tajweed), while `tajweed_rules`
// holds the handful of categories tajweed is actually *taught* in. Only
// `ghunnah` and `qalqalah` happen to share a name. Without this mapping the
// reader would colour 8,780 of 60,057 marks and silently leave the other 85%
// unstyled.
//
// The split is deliberate: this classification is linguistic and belongs in
// code where it can be tested, while the colours themselves stay in the
// database so the palette can change without a deploy.

/** Ingest rule name → `tajweed_rules.id`. */
export const RULE_CATEGORY: Record<string, string> = {
  // Madd — prolongation. All variants share one colour; the distinction between
  // them is length, not kind.
  madd_2: 'madd',
  madd_246: 'madd',
  madd_6: 'madd',
  madd_munfasil: 'madd',
  madd_muttasil: 'madd',

  // Rules of noon saakin and tanween.
  ikhfa: 'noon_saakin',
  idghaam_ghunnah: 'noon_saakin',
  idghaam_no_ghunnah: 'noon_saakin',
  iqlab: 'noon_saakin',

  // Rules of meem saakin. "Shafawi" means labial, i.e. the meem rules.
  idghaam_shafawi: 'meem_saakin',
  ikhfa_shafawi: 'meem_saakin',

  // Ghunnah proper — the nasalisation held on a doubled noon or meem.
  ghunnah: 'ghunnah',

  // Qalqalah — the echo on ق ط ب ج د.
  qalqalah: 'qalqalah',

  // Idghaam between adjacent letters, unrelated to noon/meem rules.
  idghaam_mutajanisayn: 'idghaam',
  idghaam_mutaqaribayn: 'idghaam',

  // Orthographic markers rather than articulation rules, but they are annotated
  // and learners need to see them.
  hamzat_wasl: 'hamzat_wasl',
  lam_shamsiyyah: 'lam_shamsiyyah',
  silent: 'silent',
};

/**
 * The category for a rule, or null when unrecognised.
 *
 * Returning null rather than a default colour is intentional: a silently
 * mis-coloured mark teaches the wrong thing, so an unmapped rule renders
 * uncoloured and stays visible as a gap. `tajweed-colors.test.ts` asserts every
 * rule the corpus actually contains is mapped, so null should not occur in
 * practice.
 */
export function categoryFor(rule: string): string | null {
  return RULE_CATEGORY[rule] ?? null;
}

/** Every category referenced by the mapping. Must all exist in `tajweed_rules`. */
export function referencedCategories(): string[] {
  return [...new Set(Object.values(RULE_CATEGORY))].sort();
}

export interface RawTag {
  rule: string;
  start: number;
  end: number;
}

export interface ColouredTag extends RawTag {
  /** Hex colour from `tajweed_rules`, or null when the rule is unmapped. */
  color: string | null;
  /** Display name of the category, for legends. */
  categoryName: string | null;
  category: string | null;
}

/**
 * Attach colour and category to each tag.
 *
 * `palette` maps a category id to its row from `tajweed_rules`. Built once per
 * request by the caller rather than per tag, since a long surah carries
 * thousands of annotations.
 */
export function colourTags(
  tags: RawTag[],
  palette: Map<string, { color: string; name: string }>
): ColouredTag[] {
  return tags.map((t) => {
    const category = categoryFor(t.rule);
    const entry = category ? palette.get(category) : undefined;
    return {
      ...t,
      category,
      color: entry?.color ?? null,
      categoryName: entry?.name ?? null,
    };
  });
}
