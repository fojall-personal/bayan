/**
 * Emit rule for an implied-فاعل item.
 *
 * The reconstructed token has no morphology row, so case cannot be the second
 * source. The head verb's person/gender/number is hand-verified. Written STEM
 * pronouns in the same corpus attest which surface forms carry that PNG. An
 * item is emitted only when the treebank token (folded) is among those forms.
 * No pronoun table is authored.
 */

export function foldElidedToken(token: string): string {
  return token
    .replace(/[()*]/g, '')
    .normalize('NFC')
    .replace(/[ً-ْٰۖ-ۭـ]/g, '')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

export function pngKey(
  person: string | null | undefined,
  gender: string | null | undefined,
  number: string | null | undefined
): string | null {
  if (!person || !number) return null;
  return gender ? `${person}${gender}${number}` : `${person}${number}`;
}

export function shouldEmitElidedSubject(input: {
  implied: boolean;
  rel: string | null;
  token: string | null;
  headImplied: boolean;
  headPos: string | null;
  headPng: string | null;
  attestedFolds: ReadonlySet<string> | undefined;
}): boolean {
  if (!input.implied) return false;
  if (input.rel !== 'Subj') return false;
  if (input.headImplied) return false;
  if (input.headPos !== 'V') return false;
  if (!input.headPng) return false;
  const folded = foldElidedToken(input.token ?? '');
  if (!folded) return false;
  return input.attestedFolds?.has(folded) === true;
}
