'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { gradeRecall, type RecallResult } from '@/lib/arabic-compare';
import { apiFetch } from '@/lib/api';

export function AdvancedMemorizationTools() {
  const [audioTesting, setAudioTesting] = useState(false);
  const [currentAyah, setCurrentAyah] = useState<any>(null);
  // Real grading, at last. This tracked attempts only, because grading needs the
  // ayah text and quran_verses was empty. It now holds all 6,236 verses, and
  // /api/memorization/review/today already joins text_uthmani onto every due row —
  // so the text was there the whole time once the ingest ran.
  const [attempted, setAttempted] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [lastResult, setLastResult] = useState<RecallResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
        setNotice('No ayahs are due for review today. Add some memorisation first.');
      }
    } catch (error) {
      console.error('Audio test error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = async () => {
    if (!currentAyah || !userAnswer.trim()) return;

    const expected: string = currentAyah.ayah_text ?? '';
    // Refuse to mark rather than mark wrongly. A row with no joined text would
    // otherwise score every answer as incorrect, which is worse than not scoring.
    if (!expected) {
      setNotice(
        'No text stored for this ayah, so it cannot be marked. Counted as an attempt.'
      );
      setAttempted((prev) => prev + 1);
      setUserAnswer('');
      return;
    }

    // Word-level, not all-or-nothing: one mistyped word out of twelve is not the
    // same as remembering nothing, and a binary verdict on a long ayah says nothing
    // about where the gap is. Diacritics and alef variants are folded away, because
    // requiring vowelled input would fail anyone on a plain keyboard.
    const result = gradeRecall(expected, userAnswer);
    setLastResult(result);
    setAttempted((prev) => prev + 1);
    if (result.correct) setCorrect((prev) => prev + 1);
    setUserAnswer('');

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
  // Cross-references need a theme dataset that does not exist yet (plan F12).
  // This previously built an unused array and then alert()ed a description of
  // what the feature would do, which read as a working feature.

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

      {notice && (
        <div className="rounded-md border border-ground-700 bg-ground-900 p-4 text-sm text-ground-300">
          {notice}
        </div>
      )}

      {/* Audio testing */}
      <Card>
        <h2 className="text-lg font-bold mb-3">Recall without the text</h2>
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
                    {attempted > 0
                      ? `${correct} of ${attempted} recalled`
                      : 'Type what you remember'}
                  </Badge>
                </div>
                <audio
                  controls
                  src={currentAyah.audio_url || ''}
                  className="w-full"
                />

                {/* Show the ayah with the missed words marked, rather than a bare
                    verdict. "6 of 9 words" tells you how you did; seeing WHICH three
                    you dropped tells you what to practise. */}
                {lastResult && (
                  <div
                    className={`rounded-lg border p-3 ${
                      lastResult.correct
                        ? 'border-leaf-500/50 bg-leaf-500/10'
                        : 'border-gold-500/50 bg-gold-500/10'
                    }`}
                    role="status"
                  >
                    <p
                      className={`text-sm font-semibold ${
                        lastResult.correct ? 'text-leaf-400' : 'text-gold-400'
                      }`}
                    >
                      {lastResult.correct
                        ? 'Recalled'
                        : `${lastResult.matchedWords} of ${lastResult.expectedWords} words`}
                    </p>
                    <p
                      className="text-arabic mt-2 text-xl leading-arabic"
                      dir="rtl"
                      lang="ar"
                    >
                      {(currentAyah.ayah_text ?? '').split(' ').map((w: string, i: number) => (
                        <span
                          key={i}
                          className={
                            lastResult.missed.includes(i)
                              ? 'text-gold-400 underline decoration-dotted'
                              : 'text-ground-50'
                          }
                        >
                          {w}{' '}
                        </span>
                      ))}
                    </p>
                    <p className="mt-2 text-xs text-ground-400">
                      Diacritics and alef variants are ignored, so you are not marked
                      wrong for a missing harakah.
                    </p>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    dir="rtl"
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAnswer()}
                    placeholder="Type what you heard..."
                    className="flex-1 p-3 bg-gray-800 border border-gray-700 rounded-lg text-ground-50 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-leaf-500/50 transition-all"
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
                  className="text-sm text-error hover:text-error"
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
      {/* Cross-reference memorisation (plan F12) is not built: it needs a theme
          dataset that does not exist yet. The card here previously alert()ed a
          description of the feature, which read as a working one. */}

      {/* Certificate */}
      <Card>
        <h2 className="text-lg font-bold mb-3">Memorisation certificate</h2>
        <p className="text-gray-400 text-sm mb-4">
          Generate a certificate for your memorization milestones.
        </p>
        <Button onClick={generateCertificate}>
          Generate Certificate
        </Button>

        {certificate && (
          <div className="mt-4 p-4 bg-gray-800 rounded-lg border border-leaf-500/30">
            <h3 className="font-bold text-lg text-center mb-2">{certificate.title}</h3>
            <p className="text-center text-gray-400 mb-4">{certificate.subtitle}</p>
            <div className="text-center space-y-1">
              <p className="text-xl font-bold">{certificate.userName}</p>
              <p className="text-sm text-gray-400">{certificate.date}</p>
              <div className="mt-4 text-sm">
                <p>Surahs completed: <span className="font-bold text-leaf-400">{certificate.totalSurahs}</span></p>
                <p>Ayahs memorized: <span className="font-bold text-leaf-400">{certificate.totalAyahs}</span></p>
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
