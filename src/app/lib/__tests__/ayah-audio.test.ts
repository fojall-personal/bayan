import { describe, expect, it } from 'vitest';
import {
  ayahWordClass,
  DEFAULT_RECITER,
  reciterById,
  TIMED_RECITERS,
  wordSliceShouldStop,
} from '../ayah-audio';

describe('reciterById', () => {
  it('returns a timed reciter and falls back to Mishary otherwise', () => {
    expect(reciterById('minshawi').path).toBe('Minshawy_Murattal_128kbps');
    expect(reciterById('alafasy')).toBe(DEFAULT_RECITER);
    expect(reciterById('husary')).toBe(DEFAULT_RECITER);
    expect(reciterById('nope')).toBe(DEFAULT_RECITER);
    expect(reciterById(undefined)).toBe(DEFAULT_RECITER);
    expect(TIMED_RECITERS.map((r) => r.id)).toEqual(['alafasy', 'minshawi']);
  });
});

describe('wordSliceShouldStop', () => {
  it('is false before the end and true at or past it', () => {
    expect(wordSliceShouldStop(549, 550)).toBe(false);
    expect(wordSliceShouldStop(550, 550)).toBe(true);
    expect(wordSliceShouldStop(551, 550)).toBe(true);
  });
});

describe('ayahWordClass', () => {
  it('paints unknown gold and sounding leaf, never both as colour', () => {
    expect(ayahWordClass({ known: true, sounding: false })).toBe('text-ground-50');
    expect(ayahWordClass({ known: false, sounding: false })).toContain('text-gold-400');
    expect(ayahWordClass({ known: false, sounding: false })).toContain('border-dotted');
    expect(ayahWordClass({ known: true, sounding: true })).toContain('bg-leaf-500/20');
    expect(ayahWordClass({ known: false, sounding: true })).toContain('text-gold-400');
    expect(ayahWordClass({ known: false, sounding: true })).toContain('bg-leaf-500/20');
  });
});
