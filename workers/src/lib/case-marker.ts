/**
 * Case-marker emit rule.
 *
 * Traditional iʿrāb names the MARKER (ḍamma, wāw, alif, …) separately from the
 * CASE (nominative / accusative / genitive). The morphology stores case, number
 * and gender, and the Buckwalter form carries the ending. An item exists only
 * where those two independent readings name the same marker. No marker table is
 * authored beyond this closed set.
 */

export type CaseMarker = 'damma' | 'fatha' | 'kasra' | 'waw' | 'alif' | 'ya';

export const MARKER_LABEL: Record<CaseMarker, string> = {
  damma: 'ḍamma (ضمة)',
  fatha: 'fatḥa (فتحة)',
  kasra: 'kasra (كسرة)',
  waw: 'wāw (واو)',
  alif: 'alif (ألف)',
  ya: 'yāʾ (ياء)',
};

export const MARKER_OPTIONS = Object.values(MARKER_LABEL);

export function observedMarker(
  form: string,
  number: string | null,
  gender: string | null
): CaseMarker | null {
  if (number === 'D' && /(Ani|aA)$/.test(form)) return 'alif';
  if (number === 'D' && /ayoni$/.test(form)) return 'ya';
  if (number === 'P' && gender === 'M' && /uwna$/.test(form)) return 'waw';
  if (number === 'P' && gender === 'M' && /iyna$/.test(form)) return 'ya';
  if (form === '*uw' || (number === 'S' && /uw$/.test(form))) return 'waw';
  if (/uN?$/.test(form) || /N$/.test(form)) return 'damma';
  if (/FA$/.test(form) || /aF?$/.test(form) || /F$/.test(form)) return 'fatha';
  if (/iK?$/.test(form) || /K$/.test(form)) return 'kasra';
  return null;
}

export function expectedMarker(
  kase: string,
  number: string | null,
  gender: string | null
): CaseMarker | null {
  if (number === 'D') return kase === 'NOM' ? 'alif' : 'ya';
  if (number === 'P' && gender === 'M') return kase === 'NOM' ? 'waw' : 'ya';
  if (kase === 'NOM') return 'damma';
  if (kase === 'ACC') return 'fatha';
  if (kase === 'GEN') return 'kasra';
  return null;
}

export function shouldEmitCaseMarker(input: {
  pos: string | null;
  kase: string | null;
  number: string | null;
  gender: string | null;
  form: string | null;
}): { marker: CaseMarker; diptote: boolean } | null {
  if (input.pos !== 'N') return null;
  if (!input.kase || !input.form) return null;
  const observed = observedMarker(input.form, input.number ?? null, input.gender ?? null);
  const expected = expectedMarker(input.kase, input.number ?? null, input.gender ?? null);
  if (!observed || !expected) return null;
  if (observed === expected) return { marker: observed, diptote: false };
  if (
    input.kase === 'GEN' &&
    expected === 'kasra' &&
    observed === 'fatha' &&
    (input.number === 'S' || input.number === null)
  ) {
    return { marker: 'fatha', diptote: true };
  }
  return null;
}
