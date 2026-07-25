// Quran API Integration Service
// Fetches Quran data from external APIs.
//
// UNUSED AND UNVERIFIED — nothing imports this module, and none of the three
// endpoints below has been exercised against the live services. Known problems
// before wiring it up (see docs/CODE-AUDIT-2026-07-25.md §8):
//   - getAudioUrl concatenates surah+ayah then pads, so 1:1 becomes "000011";
//     the islamic.network CDN indexes by global ayah number (1-6236).
//   - `${TANZIL_BASE}/quran-${surah}.json` is not a real Tanzil endpoint.
//   - the abdulbasit reciter code should be ar.abdulbasitmurattal.
//   - the constructor takes a KVNamespace it never uses, and wrangler.toml
//     declares no KV binding.

const TANZIL_BASE = 'https://download.tanzil.net';
const QURAN_COM_BASE = 'https://api.quran.com/api/v4';

export class QuranService {
  private kv: KVNamespace | undefined;

  constructor(kv?: KVNamespace) {
    this.kv = kv;
  }

  // Get audio URL for a specific verse (Quran.com CDN)
  getAudioUrl(surah: number, ayah: number, reciter: string = 'alafasy'): string {
    const padded = `${surah}${ayah}`.padStart(6, '0');
    const reciterMap: Record<string, string> = {
      alafasy: 'ar.alafasy',
      abdulbasit: 'ar.abdulbasitmurataq',
      minshawi: 'ar.minshawi',
    };
    const reciterCode = reciterMap[reciter] || 'ar.alafasy';
    return `https://cdn.islamic.network/quran/audio/128/${reciterCode}/${padded}.mp3`;
  }

  // Get verse text from Tanzil.net
  async getVerse(surah: number, ayah: number): Promise<string | null> {
    try {
      const url = `${TANZIL_BASE}/quran-${surah}.json`;
      const response = await fetch(url);
      if (!response.ok) return null;
      const data = (await response.json()) as Array<{ text?: string }>;
      return data[ayah - 1]?.text || null;
    } catch (error) {
      console.error(`Error fetching verse ${surah}:${ayah}:`, error);
      return null;
    }
  }

  // Get all verses for a surah
  async getSurah(surah: number): Promise<any[]> {
    try {
      const url = `${TANZIL_BASE}/quran-${surah}.json`;
      const response = await fetch(url);
      if (!response.ok) return [];
      return await response.json();
    } catch (error) {
      console.error(`Error fetching surah ${surah}:`, error);
      return [];
    }
  }

  // Get surah metadata (name, verses count)
  async getSurahInfo(surah: number): Promise<any | null> {
    try {
      const url = `${QURAN_COM_BASE}/chapters/${surah}?language=en`;
      const response = await fetch(url);
      if (!response.ok) return null;
      const data = (await response.json()) as { chapter?: unknown };
      return data.chapter ?? null;
    } catch (error) {
      console.error(`Error fetching surah info ${surah}:`, error);
      return null;
    }
  }
}
