// The 114 surahs: number, name, English gloss and ayah count.
//
// The app previously had no surah list at all — the memorization page rendered
// `Surah ${id}` and the tajweed page could not offer a picker, which is part of
// why the reader stayed a placeholder.
//
// ayahCount values are NOT hand-transcribed. They were counted directly from the
// pinned Tanzil Uthmani text (data/quran-uthmani.txt, sha256 abe6447a…d0b9a2) and
// sum to 6,236, matching the row count in `quran_verses`. Hand-typing 114 numbers
// is exactly the kind of silent error this codebase has been bitten by before.
//
// Names and translations ARE authored and worth a review.

export interface Surah {
  id: number;
  /** Transliterated name, e.g. "Al-Baqarah". */
  name: string;
  /** Common English rendering, e.g. "The Cow". */
  translation: string;
  arabic: string;
  ayahCount: number;
}

export const SURAHS: Surah[] = [
  { id: 1, name: "Al-Fatihah", translation: "The Opener", arabic: "الفاتحة", ayahCount: 7 },
  { id: 2, name: "Al-Baqarah", translation: "The Cow", arabic: "البقرة", ayahCount: 286 },
  { id: 3, name: "Ali 'Imran", translation: "Family of Imran", arabic: "آل عمران", ayahCount: 200 },
  { id: 4, name: "An-Nisa", translation: "The Women", arabic: "النساء", ayahCount: 176 },
  { id: 5, name: "Al-Ma'idah", translation: "The Table Spread", arabic: "المائدة", ayahCount: 120 },
  { id: 6, name: "Al-An'am", translation: "The Cattle", arabic: "الأنعام", ayahCount: 165 },
  { id: 7, name: "Al-A'raf", translation: "The Heights", arabic: "الأعراف", ayahCount: 206 },
  { id: 8, name: "Al-Anfal", translation: "The Spoils of War", arabic: "الأنفال", ayahCount: 75 },
  { id: 9, name: "At-Tawbah", translation: "The Repentance", arabic: "التوبة", ayahCount: 129 },
  { id: 10, name: "Yunus", translation: "Jonah", arabic: "يونس", ayahCount: 109 },
  { id: 11, name: "Hud", translation: "Hud", arabic: "هود", ayahCount: 123 },
  { id: 12, name: "Yusuf", translation: "Joseph", arabic: "يوسف", ayahCount: 111 },
  { id: 13, name: "Ar-Ra'd", translation: "The Thunder", arabic: "الرعد", ayahCount: 43 },
  { id: 14, name: "Ibrahim", translation: "Abraham", arabic: "إبراهيم", ayahCount: 52 },
  { id: 15, name: "Al-Hijr", translation: "The Rocky Tract", arabic: "الحجر", ayahCount: 99 },
  { id: 16, name: "An-Nahl", translation: "The Bee", arabic: "النحل", ayahCount: 128 },
  { id: 17, name: "Al-Isra", translation: "The Night Journey", arabic: "الإسراء", ayahCount: 111 },
  { id: 18, name: "Al-Kahf", translation: "The Cave", arabic: "الكهف", ayahCount: 110 },
  { id: 19, name: "Maryam", translation: "Mary", arabic: "مريم", ayahCount: 98 },
  { id: 20, name: "Taha", translation: "Ta-Ha", arabic: "طه", ayahCount: 135 },
  { id: 21, name: "Al-Anbya", translation: "The Prophets", arabic: "الأنبياء", ayahCount: 112 },
  { id: 22, name: "Al-Hajj", translation: "The Pilgrimage", arabic: "الحج", ayahCount: 78 },
  { id: 23, name: "Al-Mu'minun", translation: "The Believers", arabic: "المؤمنون", ayahCount: 118 },
  { id: 24, name: "An-Nur", translation: "The Light", arabic: "النور", ayahCount: 64 },
  { id: 25, name: "Al-Furqan", translation: "The Criterion", arabic: "الفرقان", ayahCount: 77 },
  { id: 26, name: "Ash-Shu'ara", translation: "The Poets", arabic: "الشعراء", ayahCount: 227 },
  { id: 27, name: "An-Naml", translation: "The Ant", arabic: "النمل", ayahCount: 93 },
  { id: 28, name: "Al-Qasas", translation: "The Stories", arabic: "القصص", ayahCount: 88 },
  { id: 29, name: "Al-'Ankabut", translation: "The Spider", arabic: "العنكبوت", ayahCount: 69 },
  { id: 30, name: "Ar-Rum", translation: "The Romans", arabic: "الروم", ayahCount: 60 },
  { id: 31, name: "Luqman", translation: "Luqman", arabic: "لقمان", ayahCount: 34 },
  { id: 32, name: "As-Sajdah", translation: "The Prostration", arabic: "السجدة", ayahCount: 30 },
  { id: 33, name: "Al-Ahzab", translation: "The Combined Forces", arabic: "الأحزاب", ayahCount: 73 },
  { id: 34, name: "Saba", translation: "Sheba", arabic: "سبأ", ayahCount: 54 },
  { id: 35, name: "Fatir", translation: "The Originator", arabic: "فاطر", ayahCount: 45 },
  { id: 36, name: "Ya-Sin", translation: "Ya Sin", arabic: "يس", ayahCount: 83 },
  { id: 37, name: "As-Saffat", translation: "Those Who Set the Ranks", arabic: "الصافات", ayahCount: 182 },
  { id: 38, name: "Sad", translation: "Sad", arabic: "ص", ayahCount: 88 },
  { id: 39, name: "Az-Zumar", translation: "The Troops", arabic: "الزمر", ayahCount: 75 },
  { id: 40, name: "Ghafir", translation: "The Forgiver", arabic: "غافر", ayahCount: 85 },
  { id: 41, name: "Fussilat", translation: "Explained in Detail", arabic: "فصلت", ayahCount: 54 },
  { id: 42, name: "Ash-Shuraa", translation: "The Consultation", arabic: "الشورى", ayahCount: 53 },
  { id: 43, name: "Az-Zukhruf", translation: "The Ornaments of Gold", arabic: "الزخرف", ayahCount: 89 },
  { id: 44, name: "Ad-Dukhan", translation: "The Smoke", arabic: "الدخان", ayahCount: 59 },
  { id: 45, name: "Al-Jathiyah", translation: "The Kneeling", arabic: "الجاثية", ayahCount: 37 },
  { id: 46, name: "Al-Ahqaf", translation: "The Wind-Curved Sandhills", arabic: "الأحقاف", ayahCount: 35 },
  { id: 47, name: "Muhammad", translation: "Muhammad", arabic: "محمد", ayahCount: 38 },
  { id: 48, name: "Al-Fath", translation: "The Victory", arabic: "الفتح", ayahCount: 29 },
  { id: 49, name: "Al-Hujurat", translation: "The Rooms", arabic: "الحجرات", ayahCount: 18 },
  { id: 50, name: "Qaf", translation: "Qaf", arabic: "ق", ayahCount: 45 },
  { id: 51, name: "Adh-Dhariyat", translation: "The Winnowing Winds", arabic: "الذاريات", ayahCount: 60 },
  { id: 52, name: "At-Tur", translation: "The Mount", arabic: "الطور", ayahCount: 49 },
  { id: 53, name: "An-Najm", translation: "The Star", arabic: "النجم", ayahCount: 62 },
  { id: 54, name: "Al-Qamar", translation: "The Moon", arabic: "القمر", ayahCount: 55 },
  { id: 55, name: "Ar-Rahman", translation: "The Beneficent", arabic: "الرحمن", ayahCount: 78 },
  { id: 56, name: "Al-Waqi'ah", translation: "The Inevitable", arabic: "الواقعة", ayahCount: 96 },
  { id: 57, name: "Al-Hadid", translation: "The Iron", arabic: "الحديد", ayahCount: 29 },
  { id: 58, name: "Al-Mujadila", translation: "The Pleading Woman", arabic: "المجادلة", ayahCount: 22 },
  { id: 59, name: "Al-Hashr", translation: "The Exile", arabic: "الحشر", ayahCount: 24 },
  { id: 60, name: "Al-Mumtahanah", translation: "She That is to be Examined", arabic: "الممتحنة", ayahCount: 13 },
  { id: 61, name: "As-Saff", translation: "The Ranks", arabic: "الصف", ayahCount: 14 },
  { id: 62, name: "Al-Jumu'ah", translation: "The Congregation", arabic: "الجمعة", ayahCount: 11 },
  { id: 63, name: "Al-Munafiqun", translation: "The Hypocrites", arabic: "المنافقون", ayahCount: 11 },
  { id: 64, name: "At-Taghabun", translation: "The Mutual Disillusion", arabic: "التغابن", ayahCount: 18 },
  { id: 65, name: "At-Talaq", translation: "The Divorce", arabic: "الطلاق", ayahCount: 12 },
  { id: 66, name: "At-Tahrim", translation: "The Prohibition", arabic: "التحريم", ayahCount: 12 },
  { id: 67, name: "Al-Mulk", translation: "The Sovereignty", arabic: "الملك", ayahCount: 30 },
  { id: 68, name: "Al-Qalam", translation: "The Pen", arabic: "القلم", ayahCount: 52 },
  { id: 69, name: "Al-Haqqah", translation: "The Reality", arabic: "الحاقة", ayahCount: 52 },
  { id: 70, name: "Al-Ma'arij", translation: "The Ascending Stairways", arabic: "المعارج", ayahCount: 44 },
  { id: 71, name: "Nuh", translation: "Noah", arabic: "نوح", ayahCount: 28 },
  { id: 72, name: "Al-Jinn", translation: "The Jinn", arabic: "الجن", ayahCount: 28 },
  { id: 73, name: "Al-Muzzammil", translation: "The Enshrouded One", arabic: "المزمل", ayahCount: 20 },
  { id: 74, name: "Al-Muddaththir", translation: "The Cloaked One", arabic: "المدثر", ayahCount: 56 },
  { id: 75, name: "Al-Qiyamah", translation: "The Resurrection", arabic: "القيامة", ayahCount: 40 },
  { id: 76, name: "Al-Insan", translation: "Man", arabic: "الإنسان", ayahCount: 31 },
  { id: 77, name: "Al-Mursalat", translation: "The Emissaries", arabic: "المرسلات", ayahCount: 50 },
  { id: 78, name: "An-Naba", translation: "The Tidings", arabic: "النبأ", ayahCount: 40 },
  { id: 79, name: "An-Nazi'at", translation: "Those Who Drag Forth", arabic: "النازعات", ayahCount: 46 },
  { id: 80, name: "'Abasa", translation: "He Frowned", arabic: "عبس", ayahCount: 42 },
  { id: 81, name: "At-Takwir", translation: "The Overthrowing", arabic: "التكوير", ayahCount: 29 },
  { id: 82, name: "Al-Infitar", translation: "The Cleaving", arabic: "الإنفطار", ayahCount: 19 },
  { id: 83, name: "Al-Mutaffifin", translation: "The Defrauding", arabic: "المطففين", ayahCount: 36 },
  { id: 84, name: "Al-Inshiqaq", translation: "The Sundering", arabic: "الإنشقاق", ayahCount: 25 },
  { id: 85, name: "Al-Buruj", translation: "The Mansions of the Stars", arabic: "البروج", ayahCount: 22 },
  { id: 86, name: "At-Tariq", translation: "The Nightcomer", arabic: "الطارق", ayahCount: 17 },
  { id: 87, name: "Al-A'la", translation: "The Most High", arabic: "الأعلى", ayahCount: 19 },
  { id: 88, name: "Al-Ghashiyah", translation: "The Overwhelming", arabic: "الغاشية", ayahCount: 26 },
  { id: 89, name: "Al-Fajr", translation: "The Dawn", arabic: "الفجر", ayahCount: 30 },
  { id: 90, name: "Al-Balad", translation: "The City", arabic: "البلد", ayahCount: 20 },
  { id: 91, name: "Ash-Shams", translation: "The Sun", arabic: "الشمس", ayahCount: 15 },
  { id: 92, name: "Al-Layl", translation: "The Night", arabic: "الليل", ayahCount: 21 },
  { id: 93, name: "Ad-Duhaa", translation: "The Morning Hours", arabic: "الضحى", ayahCount: 11 },
  { id: 94, name: "Ash-Sharh", translation: "The Relief", arabic: "الشرح", ayahCount: 8 },
  { id: 95, name: "At-Tin", translation: "The Fig", arabic: "التين", ayahCount: 8 },
  { id: 96, name: "Al-'Alaq", translation: "The Clot", arabic: "العلق", ayahCount: 19 },
  { id: 97, name: "Al-Qadr", translation: "The Power", arabic: "القدر", ayahCount: 5 },
  { id: 98, name: "Al-Bayyinah", translation: "The Clear Proof", arabic: "البينة", ayahCount: 8 },
  { id: 99, name: "Az-Zalzalah", translation: "The Earthquake", arabic: "الزلزلة", ayahCount: 8 },
  { id: 100, name: "Al-'Adiyat", translation: "The Courser", arabic: "العاديات", ayahCount: 11 },
  { id: 101, name: "Al-Qari'ah", translation: "The Calamity", arabic: "القارعة", ayahCount: 11 },
  { id: 102, name: "At-Takathur", translation: "The Rivalry in World Increase", arabic: "التكاثر", ayahCount: 8 },
  { id: 103, name: "Al-'Asr", translation: "The Declining Day", arabic: "العصر", ayahCount: 3 },
  { id: 104, name: "Al-Humazah", translation: "The Traducer", arabic: "الهمزة", ayahCount: 9 },
  { id: 105, name: "Al-Fil", translation: "The Elephant", arabic: "الفيل", ayahCount: 5 },
  { id: 106, name: "Quraysh", translation: "Quraysh", arabic: "قريش", ayahCount: 4 },
  { id: 107, name: "Al-Ma'un", translation: "The Small Kindnesses", arabic: "الماعون", ayahCount: 7 },
  { id: 108, name: "Al-Kawthar", translation: "The Abundance", arabic: "الكوثر", ayahCount: 3 },
  { id: 109, name: "Al-Kafirun", translation: "The Disbelievers", arabic: "الكافرون", ayahCount: 6 },
  { id: 110, name: "An-Nasr", translation: "The Divine Support", arabic: "النصر", ayahCount: 3 },
  { id: 111, name: "Al-Masad", translation: "The Palm Fibre", arabic: "المسد", ayahCount: 5 },
  { id: 112, name: "Al-Ikhlas", translation: "The Sincerity", arabic: "الإخلاص", ayahCount: 4 },
  { id: 113, name: "Al-Falaq", translation: "The Daybreak", arabic: "الفلق", ayahCount: 5 },
  { id: 114, name: "An-Nas", translation: "Mankind", arabic: "الناس", ayahCount: 6 },
];

/** Total ayahs across all surahs — 6,236, matching the ingested verse count. */
export const TOTAL_AYAHS = SURAHS.reduce((n, s) => n + s.ayahCount, 0);

export function getSurah(id: number): Surah | undefined {
  return SURAHS.find((s) => s.id === id);
}

/** Ayah count for a surah, or 0 when the id is out of range. */
export function ayahCountFor(id: number): number {
  return getSurah(id)?.ayahCount ?? 0;
}
