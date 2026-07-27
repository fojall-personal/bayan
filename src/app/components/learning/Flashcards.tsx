'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { apiFetch, apiPost, apiErrorMessage } from '@/lib/api';
import { rootToArabic } from '@/lib/arabic-root';
import { getSurah } from '@/lib/surahs';

interface Flashcard {
  word: string;
  /** From the vocabulary table, else the gloss for the exact ayah it came from. */
  meaning: string | null;
  transliteration: string | null;
  /** Buckwalter. Must be converted before display — see rootToArabic. */
  root: string | null;
  partOfSpeech: string | null;
  /** `"1:2"` — the ayah this word was enrolled from. Null for frequency picks. */
  source: string | null;
  /** `dictionary` | `gloss` — which chain supplied the meaning. */
  meaningSource: string | null;
  meaningKnown: number;
  readingKnown: number;
  dueDate: string;
  reviewCount: number;
}

/**
 * "1:2" → "Al-Fatihah 1:2".
 *
 * The provenance line is the point of scoping vocabulary to the hifz plan: it tells
 * the learner why THIS word and not another. A flashcard with no reason behind it is
 * a vocabulary list, which is the thing spaced repetition was meant to replace.
 */
function sourceLabel(source: string | null): string | null {
  if (!source) return null;
  const [surah, ayah] = source.split(':');
  const name = getSurah(Number(surah))?.name;
  return name ? `${name} ${surah}:${ayah}` : `${surah}:${ayah}`;
}

interface FlashcardsProps {
  userId: string;
}

export function Flashcards({ userId }: FlashcardsProps) {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMeaning, setShowMeaning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [startMessage, setStartMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchFlashcards();
  }, []);

  const fetchFlashcards = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ data: Flashcard[] }>('/api/learning/flashcards');
      setCards(data.data || []);
    } catch (error) {
      console.error('Failed to fetch flashcards:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartNewWords = async () => {
    setStarting(true);
    setStartError(null);
    setStartMessage(null);
    try {
      const { data: res } = await apiPost<{
        data: {
          added: number;
          words: string[];
          fromHifzPlan: number;
          fromFrequency: number;
          message?: string;
        };
      }>('/api/learning/vocabulary/start', { count: 10 });
      if (res.added === 0) {
        setStartMessage(res.message ?? 'No new words left to add.');
        return;
      }
      // Say where they came from. "Added 10 words" hides the thing that changed.
      const parts = [];
      if (res.fromHifzPlan > 0) parts.push(`${res.fromHifzPlan} from your hifz plan`);
      if (res.fromFrequency > 0) parts.push(`${res.fromFrequency} by frequency`);
      setStartMessage(
        `Added ${res.added} word${res.added === 1 ? '' : 's'}` +
          (parts.length ? ` — ${parts.join(', ')}.` : '.')
      );
      await fetchFlashcards();
    } catch (err) {
      console.error('Failed to add vocabulary:', err);
      setStartError(apiErrorMessage(err));
    } finally {
      setStarting(false);
    }
  };

  /**
   * FSRS grades on four named values, so the buttons send the name.
   *
   * These were 1 / 3 / 4 / 5 on a nominally five-point scale that had no 2 — the gap
   * being the tell that the numbers were never a scale, just four labels wearing
   * numbers. Naming them removes the translation step and the missing rung.
   */
  const handleReview = async (grade: 'again' | 'hard' | 'good' | 'easy') => {
    if (cards.length === 0) return;

    const card = cards[currentIndex];
    try {
      await apiPost('/api/learning/flashcards/review', {
        word: card.word,
        grade,
      });

      // Move to next card
      if (currentIndex < cards.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setShowMeaning(false);
      } else {
        // Review complete
        setCards([]);
      }
    } catch (error) {
      console.error('Failed to review card:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-ground-300">Loading flashcards…</div>
      </div>
    );
  }

  if (cards.length === 0) {
    // "All Caught Up!" used to be the permanent state of this tab: nothing ever
    // inserted into vocabulary_mastery, so the queue could not fill. The button
    // below is the way in.
    return (
      <div className="text-center py-12">
        <h2 className="mb-4 text-2xl font-bold">Nothing due right now</h2>
        <p className="mb-6 text-ground-300">
          The next batch comes from the ayahs you are memorising — the commonest words
          in your own plan first, so vocabulary and hifz pull the same direction.
        </p>
        {startError && (
          <p role="alert" className="text-sm text-red-400 mb-4">
            {startError}
          </p>
        )}
        {startMessage && (
          <p role="status" className="text-sm text-leaf-400 mb-4">
            {startMessage}
          </p>
        )}
        <div className="flex items-center justify-center gap-3">
          <Button onClick={handleStartNewWords} disabled={starting}>
            {starting ? 'Adding…' : 'Add 10 new words'}
          </Button>
          <Button variant="secondary" onClick={fetchFlashcards}>
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="text-center py-12">
        {/* Progress */}
        <div className="mb-8 text-sm text-ground-400">
          Card {currentIndex + 1} of {cards.length}
        </div>

        {/* Word */}
        <div className="text-arabic mb-4 text-5xl leading-arabic" dir="rtl" lang="ar">
          {currentCard.word}
        </div>

        {/* Why this word. Shown BEFORE the answer, because it is context rather
            than the thing being tested — and because recognising the ayah is
            itself a legitimate retrieval cue. */}
        {sourceLabel(currentCard.source) && (
          <p className="mb-8 text-sm text-gold-400">{sourceLabel(currentCard.source)}</p>
        )}

        {/* Meaning (hidden initially) */}
        {!showMeaning ? (
          <Button onClick={() => setShowMeaning(true)} className="mb-6">
            Show Meaning
          </Button>
        ) : (
          <div className="space-y-6">
            {/* Was a hardcoded ternary over ten words that printed the literal
                string "Meaning" for anything else. Meanings now come from the
                vocabulary table via GET /api/learning/flashcards. */}
            <div className="text-2xl font-semibold">
              {currentCard.meaning ?? 'No meaning recorded for this word yet'}
            </div>

            {(currentCard.transliteration || currentCard.root) && (
              <div className="space-x-3 text-sm text-ground-400">
                {currentCard.transliteration && (
                  <span className="italic">{currentCard.transliteration}</span>
                )}
                {currentCard.root && (
                  <span>
                    root{' '}
                    {/* The API returns Buckwalter — `Alh`, `qwl`. Printed raw inside
                        dir="rtl" it rendered as reversed Latin. */}
                    <span className="text-arabic" dir="rtl" lang="ar">
                      {rootToArabic(currentCard.root)}
                    </span>
                  </span>
                )}
                {currentCard.partOfSpeech && <span>· {currentCard.partOfSpeech}</span>}
              </div>
            )}

            {/* Quality Rating */}
            <div className="flex justify-center gap-3">
              <Button
                variant="danger"
                onClick={() => handleReview('again')}
                className="px-6"
              >
                Again
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleReview('hard')}
                className="px-6"
              >
                Hard
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleReview('good')}
                className="px-6"
              >
                Good
              </Button>
              <Button
                variant="primary"
                onClick={() => handleReview('easy')}
                className="px-6"
              >
                Easy
              </Button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="mt-8 text-sm text-ground-400">
          <div>Reviews: {currentCard.reviewCount}</div>
          <div className="mt-1">
            Due: {new Date(currentCard.dueDate).toLocaleDateString()}
          </div>
        </div>
      </Card>
    </div>
  );
}
