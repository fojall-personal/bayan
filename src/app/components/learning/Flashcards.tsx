'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Flashcard {
  word: string;
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

  useEffect(() => {
    fetchFlashcards();
  }, []);

  const fetchFlashcards = async () => {
    setLoading(true);
    try {
      const token = process.env.NEXT_PUBLIC_API_TOKEN;
      const res = await fetch('/api/learning/flashcards', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setCards(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch flashcards:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (quality: number) => {
    if (cards.length === 0) return;

    const card = cards[currentIndex];
    try {
      const token = process.env.NEXT_PUBLIC_API_TOKEN;
      await fetch('/api/learning/flashcards/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          word: card.word,
          quality,
        }),
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
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">All Caught Up!</h2>
        <p className="text-gray-400 mb-6">
          No flashcards due for review. Check back later or study new vocabulary.
        </p>
        <Button onClick={fetchFlashcards}>Refresh</Button>
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
            <div className="text-2xl font-semibold">
              {currentCard.word === 'اللَّه' ? 'God' :
               currentCard.word === 'رَّحْمَٰن' ? 'The Most Merciful' :
               currentCard.word === 'رَّحِيم' ? 'The Most Forgiving' :
               currentCard.word === 'يَوْم' ? 'day' :
               currentCard.word === 'عَالَمِين' ? 'worlds' :
               currentCard.word === 'عَبَد' ? 'to worship' :
               currentCard.word === 'اِهْدِنَا' ? 'guide us' :
               currentCard.word === 'صِرَاط' ? 'path, way' :
               currentCard.word === 'مُسْتَقِيم' ? 'straight' :
               currentCard.word === 'مَغْضُوب' ? 'angry, enraged' :
               'Meaning'}
            </div>

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
