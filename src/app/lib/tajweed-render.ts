// Splits an ayah into coloured runs for the tajweed reader.
//
// This replaces a `String.replace`-based renderer that was wrong in three ways
// at once, verified against Al-Fatiha 1:1:
//
//   1. It read `substring(start, end + 1)`, but `end` is already exclusive, so
//      every mark covered one character too many — "ٱل" where the hamzat wasl is
//      just "ٱ".
//   2. It used `result.replace(word, …)`, which rewrites the FIRST occurrence of
//      that text anywhere in the ayah rather than the one at `start`. 1:1 has ٱ
//      at codepoints 7, 15 and 28; all three tags landed on the first one,
//      nested three deep, and the real 2nd and 3rd went unmarked.
//   3. Each pass mutated the string it was scanning, so later replacements could
//      match inside previously injected markup.
//
// Offsets are Unicode CODEPOINT indices relative to the ayah (see
// scripts/ingest-quran.mjs), so everything here works on `[...text]` rather than
// on UTF-16 code units. Arabic in the Quran text sits in the BMP, so the two
// happen to agree today — indexing by codepoint is still the correct contract
// and costs nothing.
//
// Returning data instead of an HTML string also removes the
// dangerouslySetInnerHTML the old renderer required.

export interface RenderTag {
  rule: string;
  /** Inclusive codepoint index. */
  start: number;
  /** Exclusive codepoint index. */
  end: number;
  color?: string | null;
  category?: string | null;
}

export interface Segment {
  text: string;
  rule: string | null;
  category: string | null;
  /** Null means render with no background. */
  color: string | null;
}

/**
 * Split `text` into consecutive runs, each either plain or owned by one tag.
 *
 * Overlaps are rare but real — 40 pairs across the corpus's 60,057 annotations,
 * e.g. 2:18 where a ghunnah at [2,6) meets an iqlab at [4,8). The narrowest tag
 * wins, so the more specific rule is the one you see. Ties go to the tag listed
 * first, making the result deterministic.
 *
 * When `highlightedCategory` is set, only tags in that category keep their
 * colour; everything else renders plain. That is what the legend hover does.
 */
export function segmentVerse(
  text: string,
  tags: RenderTag[] = [],
  highlightedCategory?: string
): Segment[] {
  const cps = [...text];
  if (cps.length === 0) return [];

  // Which tag owns each codepoint, by index into `tags`.
  const owner = new Array<number | null>(cps.length).fill(null);

  const ordered = tags
    .map((tag, index) => ({ tag, index }))
    .filter(({ tag }) => Number.isInteger(tag.start) && Number.isInteger(tag.end))
    .sort((a, b) => {
      const widthA = a.tag.end - a.tag.start;
      const widthB = b.tag.end - b.tag.start;
      if (widthA !== widthB) return widthA - widthB; // narrowest, i.e. most specific
      return a.index - b.index;
    });

  for (const { tag, index } of ordered) {
    // Clamp rather than trust. A bad offset should lose its colour, not throw
    // and blank the page.
    const start = Math.max(0, tag.start);
    const end = Math.min(cps.length, tag.end);
    for (let i = start; i < end; i++) {
      if (owner[i] === null) owner[i] = index;
    }
  }

  const segments: Segment[] = [];
  let runStart = 0;

  const push = (from: number, to: number) => {
    const which = owner[from];
    const tag = which === null ? null : tags[which];
    const dimmed =
      highlightedCategory !== undefined &&
      (tag?.category ?? null) !== highlightedCategory;

    segments.push({
      text: cps.slice(from, to).join(''),
      rule: tag?.rule ?? null,
      category: tag?.category ?? null,
      color: tag && !dimmed ? (tag.color ?? null) : null,
    });
  };

  for (let i = 1; i <= cps.length; i++) {
    if (i === cps.length || owner[i] !== owner[runStart]) {
      push(runStart, i);
      runStart = i;
    }
  }

  return segments;
}
