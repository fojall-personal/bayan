// Quran API Integration Service
// Fetches Quran data from external APIs with KV caching

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
      const data = await response.json();
      const verse = data[ayah - 1];
      return verse?.text || null;
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
      const data = await response.json();
      return data.chapter;
    } catch (error) {
      console.error(`Error fetching surah info ${surah}:`, error);
      return null;
    }
  }
}
