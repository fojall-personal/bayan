/**
 * Token-governor emit rule.
 *
 * Same concur-with-morphology discipline as gen-syntax-exercises.mjs.
 * Pred (ibtidāʾ) is ʿāmil maʿnawī — no token head — so it is dropped.
 */

export type GovernorRel = 'Obj' | 'Subj' | 'Poss';

export function shouldEmitGovernor(input: {
  rel: string | null;
  headPos: string | null;
  depCase: string | null;
  headImplied: number;
}): boolean {
  if (input.headImplied === 1) return false;
  if (input.rel === 'Pred') return false;
  if (input.rel === 'Obj') {
    return input.headPos === 'V' && input.depCase === 'ACC';
  }
  if (input.rel === 'Subj') {
    return input.headPos === 'V' && input.depCase === 'NOM';
  }
  if (input.rel === 'Poss') {
    return input.depCase === 'GEN';
  }
  return false;
}

export function isGovernorRel(rel: string | null): rel is GovernorRel {
  return rel === 'Obj' || rel === 'Subj' || rel === 'Poss';
}
