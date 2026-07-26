/**
 * The rule → colour-category mapping.
 *
 * The bug this guards: the reader renders colour per annotation, but the
 * annotations use 18 rule names while `tajweed_rules` holds the categories
 * tajweed is taught in. Only `ghunnah` and `qalqalah` share a name, so an
 * unmapped rule is not a loud failure — it is a mark rendered with no colour on
 * a page whose entire purpose is colour. These tests pin the mapping to the rule
 * names the real corpus contains.
 */

import { describe, expect, it } from 'vitest';
import {
  RULE_CATEGORY,
  categoryFor,
  colourTags,
  referencedCategories,
} from '../src/lib/tajweed-colors';

/**
 * Every rule name present in tajweed.hafs.uthmani-pause-sajdah.json, with its
 * occurrence count, measured against the pinned text on 2026-07-26.
 *
 * Hard-coded rather than read from the data file: the file is 5.3 MB and
 * gitignored, so a test that loaded it would fail on a clean checkout. If the
 * ingest source ever changes, the mapping test below is what should fail.
 */
const CORPUS_RULES: Record<string, number> = {
  hamzat_wasl: 13252,
  madd_2: 9028,
  ikhfa: 5301,
  ghunnah: 4946,
  madd_246: 4543,
  silent: 4174,
  idghaam_ghunnah: 3933,
  qalqalah: 3834,
  madd_munfasil: 3172,
  lam_shamsiyyah: 2733,
  madd_muttasil: 1997,
  idghaam_no_ghunnah: 1035,
  idghaam_shafawi: 832,
  iqlab: 562,
  ikhfa_shafawi: 496,
  madd_6: 148,
  idghaam_mutajanisayn: 58,
  idghaam_mutaqaribayn: 13,
};

/** Categories with a row in tajweed_rules, after migration 0010. */
const SEEDED_CATEGORIES = new Set([
  'madd',
  'noon_saakin',
  'meem_saakin',
  'qalqalah',
  'ghunnah',
  'makharij',
  // added by 0010_tajweed_rule_colors.sql
  'hamzat_wasl',
  'lam_shamsiyyah',
  'silent',
  'idghaam',
]);

describe('tajweed rule → category mapping', () => {
  it('maps every rule the corpus actually contains', () => {
    const unmapped = Object.keys(CORPUS_RULES).filter((r) => !categoryFor(r));
    expect(unmapped).toEqual([]);
  });

  it('leaves no annotation uncoloured', () => {
    // The number that matters. Before the mapping only ghunnah and qalqalah
    // resolved, which is 8,780 of 60,057 — 85% of the page unstyled.
    const total = Object.values(CORPUS_RULES).reduce((a, b) => a + b, 0);
    const covered = Object.entries(CORPUS_RULES)
      .filter(([r]) => categoryFor(r))
      .reduce((n, [, c]) => n + c, 0);

    expect(total).toBe(60057);
    expect(covered).toBe(total);
  });

  it('only references categories that exist in tajweed_rules', () => {
    // A category with no row yields a null colour — the same silent failure the
    // mapping was added to fix.
    const missing = referencedCategories().filter((c) => !SEEDED_CATEGORIES.has(c));
    expect(missing).toEqual([]);
  });

  it('groups the madd variants together — they differ in length, not kind', () => {
    for (const r of ['madd_2', 'madd_246', 'madd_6', 'madd_munfasil', 'madd_muttasil']) {
      expect(categoryFor(r)).toBe('madd');
    }
  });

  it('files the shafawi rules under meem saakin, not noon saakin', () => {
    // "Shafawi" is labial — these are meem rules. Getting this wrong would
    // colour them as noon rules and teach the wrong category.
    expect(categoryFor('idghaam_shafawi')).toBe('meem_saakin');
    expect(categoryFor('ikhfa_shafawi')).toBe('meem_saakin');
    expect(categoryFor('ikhfa')).toBe('noon_saakin');
    expect(categoryFor('iqlab')).toBe('noon_saakin');
  });

  it('returns null for an unknown rule rather than guessing a colour', () => {
    expect(categoryFor('not_a_rule')).toBeNull();
  });
});

describe('colourTags', () => {
  const palette = new Map([
    ['qalqalah', { color: '#f59e0b', name: 'Qalqalah (قلقة)' }],
    ['noon_saakin', { color: '#22c55e', name: 'Noon Saakin & Tanween' }],
  ]);

  it('attaches colour and category name from the palette', () => {
    const [tag] = colourTags([{ rule: 'iqlab', start: 4, end: 5 }], palette);
    expect(tag).toMatchObject({
      rule: 'iqlab',
      start: 4,
      end: 5,
      category: 'noon_saakin',
      color: '#22c55e',
      categoryName: 'Noon Saakin & Tanween',
    });
  });

  it('yields a null colour when the category has no palette row', () => {
    const [tag] = colourTags([{ rule: 'madd_2', start: 0, end: 1 }], palette);
    expect(tag.category).toBe('madd');
    expect(tag.color).toBeNull();
  });

  it('preserves offsets exactly — they are codepoint indices into the ayah', () => {
    const tags = [
      { rule: 'qalqalah', start: 0, end: 1 },
      { rule: 'qalqalah', start: 17, end: 18 },
    ];
    const out = colourTags(tags, palette);
    expect(out.map((t) => [t.start, t.end])).toEqual([
      [0, 1],
      [17, 18],
    ]);
  });
});
