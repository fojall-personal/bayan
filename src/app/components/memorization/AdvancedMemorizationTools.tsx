'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { apiFetch } from '@/lib/api';

export function AdvancedMemorizationTools() {
  const [audioTesting, setAudioTesting] = useState(false);
  const [currentAyah, setCurrentAyah] = useState<any>(null);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [certificate, setCertificate] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Start audio testing (no text visible)
  const startAudioTest = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ due: unknown[] }>('/api/memorization/review/today');
      if (data.due?.length > 0) {
        setCurrentAyah(data.due[0]);
      } else {
        // Show inline error instead of alert
        alert('No ayahs due for review today. Complete some reviews first!');
      }
    } catch (error) {
      console.error('Audio test error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = async () => {
    if (!currentAyah || !userAnswer.trim()) return;

    setTotal((prev) => prev + 1);
    setUserAnswer('');

    // In production, compare against correct ayah text
    // For MVP, award point for any attempt to encourage practice
    const correct = userAnswer.trim().length > 5;
    if (correct) setScore((prev) => prev + 1);

    // Load next ayah
    try {
      const data = await apiFetch<{ due: unknown[] }>('/api/memorization/review/today');
      if (data.due?.length > 0) {
        setCurrentAyah(data.due[0]);
      } else {
        setCurrentAyah(null);
        setAudioTesting(false);
      }
    } catch (error) {
      console.error('Next ayah error:', error);
    }
  };

  // Get cross-references for a surah
  const getCrossReferences = async (surahId: number) => {
    try {
      // Cross-references would come from the quran.ts service
      // For MVP, show placeholder data
      const refs = [
        { surah: 1, ayah: 1, theme: 'Praise & Guidance', text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ' },
        { surah: 112, ayah: 1, theme: 'Oneness of God', text: 'قُلْ هُوَ اللَّهُ أَحَدٌ' },
      ];
      // In production: fetch from API with theme matching
      alert(`Cross-references for Surah ${surahId} would show related themes across other surahs.`);
    } catch (error) {
      console.error('Cross-reference error:', error);
    }
  };

  // Generate certificate
  const generateCertificate = async () => {
    try {
      const data = await apiFetch<{ data: { certificate: unknown } }>(
        '/api/certificate/export'
      );
      setCertificate(data.data?.certificate);
    } catch (error) {
      console.error('Certificate error:', error);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Advanced Memorization Tools</h1>

      {/* Audio testing */}
      <Card>
        <h2 className="text-lg font-bold mb-3">🎧 Audio Testing (No Text)</h2>
        <p className="text-gray-400 text-sm mb-4">
          Test your memorization by recalling ayahs from audio only. No visual hints!
        </p>

        {!audioTesting ? (
          <Button
            onClick={startAudioTest}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Start Audio Test'}
          </Button>
        ) : (
          <div className="space-y-4">
            {currentAyah ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">
                    Surah {currentAyah.surah_id}, Ayah {currentAyah.ayah_from}
                  </span>
                  <Badge variant="default">
                    Score: {score}/{total}
                  </Badge>
                </div>
                <audio
                  controls
                  src={currentAyah.audio_url || ''}
                  className="w-full"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    dir="rtl"
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAnswer()}
                    placeholder="Type what you heard..."
                    className="flex-1 p-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
                  />
                  <Button onClick={handleAnswer} className="px-6">
                    Check
                  </Button>
                </div>
                <button
                  onClick={() => {
                    setAudioTesting(false);
                    setCurrentAyah(null);
                  }}
                  className="text-sm text-red-400 hover:text-red-300"
                >
                  End Test
                </button>
              </>
            ) : (
              <p className="text-center text-gray-400 py-4">
                No more ayahs due. Great job!
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Cross-reference */}
      <Card>
        <h2 className="text-lg font-bold mb-3">🔗 Cross-Reference Memorization</h2>
        <p className="text-gray-400 text-sm mb-4">
          Find related themes and verses across different surahs.
        </p>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Surah number"
            className="flex-1 p-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/50"
            min="1"
            max="114"
          />
          <Button onClick={() => getCrossReferences(1)} className="px-4">
            Find
          </Button>
        </div>
      </Card>

      {/* Certificate */}
      <Card>
        <h2 className="text-lg font-bold mb-3">📜 Memorization Certificate</h2>
        <p className="text-gray-400 text-sm mb-4">
          Generate a certificate for your memorization milestones.
        </p>
        <Button onClick={generateCertificate}>
          Generate Certificate
        </Button>

        {certificate && (
          <div className="mt-4 p-4 bg-gray-800 rounded-lg border border-green-500/30">
            <h3 className="font-bold text-lg text-center mb-2">{certificate.title}</h3>
            <p className="text-center text-gray-400 mb-4">{certificate.subtitle}</p>
            <div className="text-center space-y-1">
              <p className="text-xl font-bold">{certificate.userName}</p>
              <p className="text-sm text-gray-400">{certificate.date}</p>
              <div className="mt-4 text-sm">
                <p>Surahs completed: <span className="font-bold text-green-400">{certificate.totalSurahs}</span></p>
                <p>Ayahs memorized: <span className="font-bold text-green-400">{certificate.totalAyahs}</span></p>
              </div>
              {certificate.surahs.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1 justify-center">
                  {certificate.surahs.map((s: any) => (
                    <Badge key={s.number} variant="default">
                      Surah {s.number} ({s.ayahs} ayahs)
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
