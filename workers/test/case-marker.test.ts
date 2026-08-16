import { describe, expect, it } from 'vitest';
import {
  expectedMarker,
  observedMarker,
  shouldEmitCaseMarker,
} from '../src/lib/case-marker';

describe('case-marker emit rule', () => {
  it('reads ḍamma from definite and tanwīn nominatives', () => {
    expect(observedMarker('kita`bu', 'S', 'M')).toBe('damma');
    expect(observedMarker('gi$a`wapN', 'S', 'F')).toBe('damma');
    expect(expectedMarker('NOM', 'S', 'M')).toBe('damma');
  });

  it('reads letter markers from dual and sound masculine plural', () => {
    expect(observedMarker('wa`lidaAni', 'D', 'M')).toBe('alif');
    expect(observedMarker('wa`lidayoni', 'D', 'M')).toBe('ya');
    expect(observedMarker('mufoliHuwna', 'P', 'M')).toBe('waw');
    expect(observedMarker('Ea`lamiyna', 'P', 'M')).toBe('ya');
  });

  it('does not treat lisaAni (singular genitive) as a dual alif', () => {
    expect(observedMarker('lisaAni', 'S', 'M')).toBe('kasra');
  });

  it('emits when form and case name the same marker', () => {
    expect(
      shouldEmitCaseMarker({
        pos: 'N',
        kase: 'NOM',
        number: 'P',
        gender: 'M',
        form: 'mufoliHuwna',
      })
    ).toEqual({ marker: 'waw', diptote: false });
  });

  it('emits a diptote genitive that wears fatḥa', () => {
    expect(
      shouldEmitCaseMarker({
        pos: 'N',
        kase: 'GEN',
        number: 'S',
        gender: 'M',
        form: 'Sira`Ta',
      })
    ).toEqual({ marker: 'fatha', diptote: true });
  });

  it('drops a verb and a mismatched ending', () => {
    expect(
      shouldEmitCaseMarker({
        pos: 'V',
        kase: 'NOM',
        number: 'S',
        gender: 'M',
        form: 'qaAla',
      })
    ).toBeNull();
    expect(
      shouldEmitCaseMarker({
        pos: 'N',
        kase: 'NOM',
        number: 'S',
        gender: 'M',
        form: 'rab~i',
      })
    ).toBeNull();
  });
});
