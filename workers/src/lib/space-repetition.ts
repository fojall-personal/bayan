// SM-2 Spaced Repetition Algorithm for Memorization
// Adapted from SuperMemo algorithm for Quran hifz tracking

interface MemorizationEntry {
  id: string;
  quality: number;
  interval: number;
  ease_factor: number;
  reviews_count: number;
  status: 'new' | 'learning' | 'reviewing' | 'mastered';
  next_review: string;
}

interface SM2Result {
  nextReview: string;
  interval: number;
  easeFactor: number;
  status: 'new' | 'learning' | 'reviewing' | 'mastered';
}

// SM-2 spaced repetition algorithm
export function applySM2(entry: MemorizationEntry, quality: number): SM2Result {
  let { interval, ease_factor } = entry;

  // Default initial values
  if (interval === 0) interval = 1;
  if (ease_factor < 1.3) ease_factor = 2.5;

  if (quality <= 2) {
    // Poor recall — reset to 1 day
    interval = 1;
    ease_factor = Math.max(1.3, ease_factor - 0.2);
  } else if (quality === 3) {
    // OK recall — small interval increase
    interval = Math.round(interval * 1.2);
  } else if (quality === 4) {
    // Good recall — double interval
    interval = Math.round(interval * 2);
  } else {
    // Perfect recall — 2.5x interval
    interval = Math.round(interval * 2.5);
    ease_factor = Math.min(3.0, ease_factor + 0.15);
  }

  // After 6 consecutive perfect recalls, increase interval multiplier
  if (quality === 5 && entry.reviews_count > 6) {
    interval = Math.round(interval * 1.5);
  }

  // Determine status based on interval
  let status = entry.status;
  if (interval >= 30 && quality >= 4) {
    status = 'mastered';
  } else if (interval >= 7) {
    status = 'reviewing';
  } else {
    status = 'learning';
  }

  // Calculate next review date
  const nextReview = new Date(Date.now() + interval * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  return {
    nextReview,
    interval,
    easeFactor: ease_factor,
    status,
  };
}

interface ReviewDay {
  day: number;
  label: string;
  description: string;
}

// Calculate review schedule for a surah
export function calculateReviewSchedule(surahId: number, entryCount: number): ReviewDay[] {
  const schedule: ReviewDay[] = [];
  const days = [1, 2, 4, 7, 14, 30, 60, 90, 180, 365];

  for (let i = 0; i < days.length; i++) {
    schedule.push({
      day: days[i],
      label: getReviewLabel(days[i]),
      description: getReviewDescription(days[i]),
    });
  }

  return schedule;
}

function getReviewLabel(days: number): string {
  if (days === 1) return 'Today';
  if (days === 2) return 'Tomorrow';
  if (days === 7) return '1 week';
  if (days === 30) return '1 month';
  if (days === 365) return '1 year';
  return `${days} days`;
}

function getReviewDescription(days: number): string {
  if (days <= 1) return 'Review today to reinforce memory';
  if (days <= 7) return 'Regular review to maintain recall';
  if (days <= 30) return 'Monthly maintenance review';
  return 'Annual maintenance — quick scan through memorization';
}
