'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { apiFetch, apiPost, apiErrorMessage } from '@/lib/api';

interface Flashcard {
  word: string;
  /** From the vocabulary content table. Null if the word has no entry. */
  meaning: string | null;
  transliteration: string | null;
  root: string | null;
  partOfSpeech: string | null;
  meaningKnown: number;
  readingKnown: number;
  dueDate: string;
  reviewCount: number;
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
      const res = await apiPost<{ added: number; words: string[]; message?: string }>(
        '/api/learning/vocabulary/start',
        { count: 10 }
      );
      if (res.added === 0) {
        setStartMessage(res.message ?? 'No new words left to add.');
        return;
      }
      setStartMessage(`Added ${res.added} word${res.added === 1 ? '' : 's'}.`);
      await fetchFlashcards();
    } catch (err) {
      console.error('Failed to add vocabulary:', err);
      setStartError(apiErrorMessage(err));
    } finally {
      setStarting(false);
    }
  };

  const handleReview = async (quality: number) => {
    if (cards.length === 0) return;

    const card = cards[currentIndex];
    try {
      await apiPost('/api/learning/flashcards/review', {
        word: card.word,
        quality,
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
        <div className="text-gray-400">Loading flashcards...</div>
      </div>
    );
  }

  if (cards.length === 0) {
    // "All Caught Up!" used to be the permanent state of this tab: nothing ever
    // inserted into vocabulary_mastery, so the queue could not fill. The button
    // below is the way in.
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">Nothing due right now</h2>
        <p className="text-gray-400 mb-6">
          Add the next batch of high-frequency Quranic words to start reviewing.
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
        <div className="text-sm text-gray-400 mb-8">
          Card {currentIndex + 1} of {cards.length}
        </div>

        {/* Word */}
        <div className="text-5xl text-arabic mb-8" dir="rtl">
          {currentCard.word}
        </div>

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
              <div className="text-sm text-gray-400 space-x-3">
                {currentCard.transliteration && (
                  <span className="italic">{currentCard.transliteration}</span>
                )}
                {currentCard.root && (
                  <span>
                    root <span dir="rtl">{currentCard.root}</span>
                  </span>
                )}
                {currentCard.partOfSpeech && <span>· {currentCard.partOfSpeech}</span>}
              </div>
            )}

            {/* Quality Rating */}
            <div className="flex justify-center gap-3">
              <Button
                variant="danger"
                onClick={() => handleReview(1)}
                className="px-6"
              >
                Again
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleReview(3)}
                className="px-6"
              >
                Hard
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleReview(4)}
                className="px-6"
              >
                Good
              </Button>
              <Button
                variant="primary"
                onClick={() => handleReview(5)}
                className="px-6"
              >
                Easy
              </Button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="mt-8 text-sm text-gray-400">
          <div>Reviews: {currentCard.reviewCount}</div>
          <div className="mt-1">
            Due: {new Date(currentCard.dueDate).toLocaleDateString()}
          </div>
        </div>
      </Card>
    </div>
  );
}
