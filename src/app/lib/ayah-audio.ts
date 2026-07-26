// Per-ayah recitation audio URLs.
//
// The plan originally assumed this needed the Quran Foundation API and
// credentials nobody had, which is why two audio components sat orphaned and two
// separate `setTimeout` fakes shipped in their place. It does not: everyayah.com
// serves per-ayah MP3s over a predictable path with no key and no signup.
// Verified 2026-07-26 — 200 audio/mpeg.
//
// The path is zero-padded surah then zero-padded ayah, three digits each, so
// 1:1 is 001001.mp3 and 114:6 is 114006.mp3. No global 1..6236 ayah numbering is
// required, which is the trap with the other CDNs: cdn.islamic.network keys on a
// running total, so getting it wrong plays a completely unrelated verse rather
// than failing.

export interface Reciter {
  id: string;
  name: string;
  /** Directory segment on everyayah.com. */
  path: string;
}

export const RECITERS: Reciter[] = [
  { id: 'alafasy', name: 'Mishary Alafasy', path: 'Alafasy_128kbps' },
  { id: 'husary', name: 'Mahmoud Khalil Al-Husary', path: 'Husary_128kbps' },
  { id: 'minshawi', name: 'Mohamed Siddiq Al-Minshawi', path: 'Minshawy_Murattal_128kbps' },
];

export const DEFAULT_RECITER = RECITERS[0];

const pad3 = (n: number) => String(n).padStart(3, '0');

/**
 * URL for one ayah's recitation.
 *
 * Throws on out-of-range input rather than returning a URL that 404s at play
 * time, where the only symptom would be a button that silently does nothing.
 */
export function ayahAudioUrl(
  surah: number,
  ayah: number,
  reciter: Reciter = DEFAULT_RECITER
): string {
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) {
    throw new RangeError(`surah must be 1..114, got ${surah}`);
  }
  if (!Number.isInteger(ayah) || ayah < 1 || ayah > 286) {
    // 286 is the longest surah (Al-Baqarah). A per-surah table would be tighter
    // but this catches the mistakes that matter: 0, negatives and non-integers.
    throw new RangeError(`ayah must be 1..286, got ${ayah}`);
  }
  return `https://everyayah.com/data/${reciter.path}/${pad3(surah)}${pad3(ayah)}.mp3`;
}
