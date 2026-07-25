// Shared types for Language Builder
// Synced between Workers (backend) and Next.js (frontend)

export interface UserProfile {
  id: string;
  created_at: string;
  goal: 'read_quran' | 'understand_arabic' | 'memorize_quran' | 'all';
  onboarding_completed: boolean;
  current_path: string; // path1, path2, path3
}

export interface AssessmentResult {
  id: string;
  user_id: string;
  completed_at: string;
  literacy_score: number;
  comprehension_score: number;
  grammar_score: number;
  memorization_score: number;
  level: 'beginner' | 'intermediate' | 'advanced';
  details: Record<string, unknown>;
}

export interface LessonProgress {
  lesson_id: string;
  module: 'literacy' | 'grammar' | 'vocabulary' | 'tajweed';
  completed: boolean;
  score: number;
  attempts: number;
  last_practiced: string | null;
  next_review: string | null;
  streak: number;
}

export interface MemorizationEntry {
  id: number;
  user_id: string;
  surah_id: number;
  ayah_from: number;
  ayah_to: number;
  status: 'new' | 'learning' | 'reviewing' | 'mastered';
  last_reviewed: string | null;
  next_review: string;
  quality: number;
  revision_count: number;
}

export interface Lesson {
  id: string;
  title: string;
  module: string;
  level: number;
  content: unknown; // JSON
  exercises: unknown; // JSON
  prerequisites: string[];
  estimated_minutes: number;
}

/** A `lessons` row exactly as D1 returns it — the JSON columns are still strings. */
export interface LessonRow {
  id: string;
  title: string;
  module: string;
  level: number;
  content: string;
  exercises: string;
  prerequisites: string;
  estimated_minutes: number;
}

export interface QuizAttempt {
  id: string;
  user_id: string;
  lesson_id: string;
  module: string;
  questions_answered: number;
  questions_correct: number;
  time_seconds: number | null;
  completed_at: string;
}

export interface SpacedRepetitionItem {
  id: number;
  user_id: string;
  item_type: 'vocabulary' | 'lesson' | 'memorization';
  item_id: string;
  interval_days: number;
  ease_factor: number;
  due_date: string;
  reviews_count: number;
  next_review: string;
}

export interface VocabularyMastery {
  word: string;
  user_id: string;
  meaning_known: number;
  reading_known: number;
  last_seen: string | null;
  next_review: string;
  reviews: number;
  ease_factor: number;
  interval_days: number;
}

export interface QuranVerse {
  surah: number;
  ayah: number;
  text_uthmani: string;
  text_simple: string;
  translation: string;
  audio_url?: string;
  tajweed_tags?: TajweedTag[];
}

export interface TajweedTag {
  start: number;
  end: number;
  rule: string;
  color: string;
}

// API response types
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
}
