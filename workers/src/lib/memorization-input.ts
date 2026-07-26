// Validation for POST /api/memorization/add.
//
// The endpoint previously accepted whatever it was sent: surah 999, ayah -5,
// ayahFrom greater than ayahTo, floats, strings. That went unnoticed because no
// UI called it. Now that one does, and because the bearer token ships in the JS
// bundle, anything that can load the page can also post directly — so the
// browser's own checks are a convenience, not a guard.
//
// The upper bound on ayah numbers is deliberately NOT hard-coded here. Surah
// lengths already exist in `quran_verses`, and duplicating 114 numbers in a
// second place invites the two copies to drift. The caller checks the bound
// against the database when the text has been ingested, and skips it when the
// table is empty so a fresh deployment stays usable.

export const SURAH_COUNT = 114;

/** Longest surah in the Quran (Al-Baqarah), used only as a sanity ceiling. */
export const MAX_AYAH = 286;

export interface AyahRange {
  surahId: number;
  ayahFrom: number;
  ayahTo: number;
}

export type ParseResult =
  | { ok: true; value: AyahRange }
  | { ok: false; error: string };

function asInt(value: unknown): number | null {
  // Reject "3" as well as 3.5. A string that looks like a number usually means
  // the caller is guessing at the contract.
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

export function parseAyahRange(body: unknown): ParseResult {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Expected a JSON object' };
  }

  const { surahId, ayahFrom, ayahTo } = body as Record<string, unknown>;

  const surah = asInt(surahId);
  if (surah === null) return { ok: false, error: 'surahId must be an integer' };
  if (surah < 1 || surah > SURAH_COUNT) {
    return { ok: false, error: `surahId must be between 1 and ${SURAH_COUNT}` };
  }

  const from = asInt(ayahFrom);
  if (from === null) return { ok: false, error: 'ayahFrom must be an integer' };

  const to = asInt(ayahTo);
  if (to === null) return { ok: false, error: 'ayahTo must be an integer' };

  if (from < 1) return { ok: false, error: 'ayahFrom must be 1 or greater' };
  if (to < from) {
    return { ok: false, error: 'ayahTo must be greater than or equal to ayahFrom' };
  }
  if (to > MAX_AYAH) {
    return { ok: false, error: `ayahTo cannot exceed ${MAX_AYAH}` };
  }

  return { ok: true, value: { surahId: surah, ayahFrom: from, ayahTo: to } };
}
