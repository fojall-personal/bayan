import { afterEach, describe, expect, it } from 'vitest';
import { harness, TEST_USER, type Harness } from './helpers/harness';

let h: Harness | null = null;
afterEach(() => {
  h?.close();
  h = null;
});
const H = () => (h ??= harness());

/**
 * Q8 (locked 2026-08-16): a cold iʿrāb ayah is one the learner has not marked
 * mastered in hifz. Status = reviewing still counts as unfamiliar.
 */
describe('GET /api/grammar/irab-parse unfamiliar = not mastered', () => {
  it('skips an ayah the user has mastered and still returns another', async () => {
    const t = H();
    t.db
      .prepare(
        `INSERT INTO quran_verses (surah, ayah, text_uthmani, text_simple, translation, tajweed_tags)
         VALUES (1, 2, 'يَعْبُدُ رَبَّهُ يَوْمَئِذٍ كِتَابٌ', 'x', null, '[]')`
      )
      .run();
    t.db
      .prepare(
        `INSERT INTO quran_verses (surah, ayah, text_uthmani, text_simple, translation, tajweed_tags)
         VALUES (1, 3, 'كَتَبَ رَبَّهُ يَوْمَئِذٍ كِتَابٌ', 'x', null, '[]')`
      )
      .run();
    const morph = t.db.prepare(
      `INSERT INTO quran_word_morphology
         (surah_id, ayah_id, word_index, segment_index, form, pos, case_case)
       VALUES (?, ?, ?, 1, 'x', ?, ?)`
    );
    for (const ayah of [2, 3]) {
      morph.run(1, ayah, 1, 'V', null);
      morph.run(1, ayah, 2, 'N', 'ACC');
      morph.run(1, ayah, 3, 'N', null);
      morph.run(1, ayah, 4, 'N', null);
      const syn = t.db.prepare(
        `INSERT INTO quran_syntax (sentence_id, token_index, head_index, surah_id, ayah_id,
           word_index, segment_index, rel, rel_ar, constituent, derived_noun, token, is_implied)
         VALUES (?, ?, ?, 1, ?, ?, 1, ?, NULL, NULL, NULL, ?, 0)`
      );
      const sid = ayah * 10;
      syn.run(sid, 0, null, ayah, 1, 'root', 'يَعْبُدُ');
      syn.run(sid, 1, 0, ayah, 2, 'Obj', 'رَبَّهُ');
    }
    t.db
      .prepare(
        `INSERT INTO memorization (id, user_id, surah_id, ayah_from, ayah_to, status)
         VALUES ('m1', '${TEST_USER}', 1, 2, 2, 'mastered')`
      )
      .run();

    const { status, body } = await t.json<{ data: { surah: number; ayah: number } | null }>(
      '/api/grammar/irab-parse'
    );
    expect(status).toBe(200);
    expect(body.data).not.toBeNull();
    expect(body.data?.ayah).toBe(3);
  });
});
