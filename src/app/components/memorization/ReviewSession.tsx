'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { apiPost } from '@/lib/api';

interface MemorizationEntry {
  id: string;
  surah_id: number;
  ayah_from: number;
  ayah_to: number;
  status: string;
  ayah_text?: string;
}

interface ReviewSessionProps {
  entry: MemorizationEntry;
  onComplete: (quality: number) => void;
  onSkip: () => void;
}

export function ReviewSession({ entry, onComplete, onSkip }: ReviewSessionProps) {
  const [step, setStep] = useState<'listen' | 'recite' | 'rate'>('listen');
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [selfRating, setSelfRating] = useState(0);

  const handlePlayAudio = () => {
    setAudioPlaying(true);
    // Placeholder audio playback — would integrate with Quran.com API audio
    setTimeout(() => setAudioPlaying(false), 3000);
  };

  const handleRecite = async () => {
    setStep('rate');
  };

  const handleRate = (quality: number) => {
    setSelfRating(quality);
    // Submit review result
    apiPost(`/api/memorization/${entry.id}/review`, { quality })
      .then(() => onComplete(quality))
      .catch(console.error);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Ayah display */}
      <Card className="text-center py-8">
        <div className="text-3xl text-leaf-400 mb-4 arabic-text" dir="rtl">
          {entry.ayah_text || `Surah ${entry.surah_id}, Ayahs ${entry.ayah_from}-${entry.ayah_to}`}
        </div>
        <p className="text-gray-400">
          Surah {entry.surah_id}, Ayahs {entry.ayah_from}-{entry.ayah_to}
        </p>
      </Card>

      {/* Step 1: Listen */}
      {step === 'listen' && (
        <Card>
          <h3 className="text-xl font-semibold mb-4">Step 1: Listen</h3>
          <p className="text-gray-400 mb-6">Listen to the recitation and read along</p>

          <Button
            onClick={handlePlayAudio}
            disabled={audioPlaying}
            className="w-full py-4 text-lg"
          >
            {audioPlaying ? 'Playing...' : '▶ Play Recitation'}
          </Button>

          <Button
            variant="secondary"
            onClick={() => setStep('recite')}
            className="w-full mt-4"
          >
            I&apos;ve listened — continue to recite
          </Button>
        </Card>
      )}

      {/* Step 2: Recite */}
      {step === 'recite' && (
        <Card>
          <h3 className="text-xl font-semibold mb-4">Step 2: Recite</h3>
          <p className="text-gray-400 mb-6">Record yourself reciting the ayahs</p>

          <Button onClick={handleRecite} className="w-full py-4 text-lg">
            🎤 Record Recitation
          </Button>

          <Button variant="ghost" onClick={onSkip} className="w-full mt-4">
            Skip for now
          </Button>
        </Card>
      )}

      {/* Step 3: Rate */}
      {step === 'rate' && (
        <Card>
          <h3 className="text-xl font-semibold mb-4">Step 3: Rate Your Recall</h3>
          <p className="text-gray-400 mb-6">How well did you remember?</p>

          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((quality) => (
              <button
                key={quality}
                onClick={() => handleRate(quality)}
                className={`w-full p-3 rounded-lg text-left transition-colors ${
                  selfRating === quality
                    ? 'bg-leaf-500/20 border border-leaf-500'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {getQualityLabel(quality)}
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function getQualityLabel(quality: number): string {
  const labels: Record<number, string> = {
    1: "I didn't remember at all",
    2: 'I struggled to recall',
    3: 'I remembered with difficulty',
    4: 'I remembered fairly well',
    5: 'I remembered perfectly',
  };
  return labels[quality] || '';
}
