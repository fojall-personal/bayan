'use client';

// The graded memorization curriculum: 908 units derived from the pinned text.
//
// The tracker already worked, but a learner had to invent their own plan — pick a
// surah, pick a range, guess what amount was sensible. This is the plan, ordered
// shortest-surah-first, with each unit stating why it sits where it does.
//
// Units already being tracked are marked rather than offered again, so adding one
// twice is not something the UI invites and then rejects with a 409.

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { apiFetch, apiErrorMessage, ApiError } from '@/lib/api';

interface Unit {
  id: string;
  sequence: number;
  level: number;
  surahId: number;
  surahName: string;
  ayahFrom: number;
  ayahTo: number;
  ayahCount: number;
  rationale: string;
  tracked: boolean;
  status: string | null;
}

const LEVELS = [
  { value: '', label: 'All levels' },
  { value: '1', label: 'Level 1 — short surahs, whole' },
  { value: '2', label: 'Level 2' },
  { value: '3', label: 'Level 3' },
  { value: '4', label: 'Level 4' },
  { value: '5', label: 'Level 5' },
  { value: '6', label: 'Level 6 — long passages' },
];

interface CurriculumPickerProps {
  onAdded: () => void;
}

export function CurriculumPicker({ onAdded }: CurriculumPickerProps) {
  const [level, setLevel] = useState('1');
  const [units, setUnits] = useState<Unit[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '25', offset: String(offset) });
      if (level) params.set('level', level);
      const res = await apiFetch<{ data: Unit[]; total: number }>(
        `/api/memorization/curriculum?${params}`
      );
      setUnits(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch (err) {
      console.error('Failed to load curriculum:', err);
      setError(apiErrorMessage(err));
      setUnits([]);
    } finally {
      setLoading(false);
    }
  }, [level, offset]);

  useEffect(() => {
    load();
  }, [load]);

  const start = async (unit: Unit) => {
    setAdding(unit.id);
    setMessage(null);
    try {
      await apiFetch('/api/memorization/add', {
        method: 'POST',
        body: JSON.stringify({
          surahId: unit.surahId,
          ayahFrom: unit.ayahFrom,
          ayahTo: unit.ayahTo,
        }),
      });
      setMessage(
        `Added ${unit.surahName} ${unit.ayahFrom}${
          unit.ayahTo !== unit.ayahFrom ? `–${unit.ayahTo}` : ''
        }. Due for review tomorrow.`
      );
      // Refresh so the unit shows as tracked, and let the parent update its counts.
      await load();
      onAdded();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setMessage('You are already tracking that range.');
      } else {
        console.error('Failed to add unit:', err);
        setError(apiErrorMessage(err));
      }
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <Select
          label="Level"
          value={level}
          onChange={(v) => {
            setLevel(v);
            setOffset(0);
          }}
          options={LEVELS}
        />
        <p className="text-sm text-gray-400 mt-3">
          {total} unit{total === 1 ? '' : 's'} at this level, ordered shortest surah
          first — which is how they are learned in practice.
        </p>
      </Card>

      {message && (
        <p role="status" className="text-sm text-leaf-400">
          {message}
        </p>
      )}
      {error && (
        <Card>
          <p className="text-gray-300 mb-4">{error}</p>
          <Button variant="secondary" onClick={load}>
            Try again
          </Button>
        </Card>
      )}

      {loading ? (
        <Card className="text-center py-10">
          <p className="text-gray-400">Loading curriculum…</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {units.map((u) => (
            <Card key={u.id} className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-gray-500">#{u.sequence}</span>
                  <h3 className="font-semibold">
                    {u.surahName}{' '}
                    <span className="text-gray-400 font-normal">
                      {u.ayahFrom}
                      {u.ayahTo !== u.ayahFrom ? `–${u.ayahTo}` : ''}
                    </span>
                  </h3>
                  <span className="text-xs text-gray-500">
                    {u.ayahCount} ayah{u.ayahCount === 1 ? '' : 's'}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-1">{u.rationale}</p>
              </div>
              {u.tracked ? (
                <span className="text-sm text-leaf-400 shrink-0">
                  Tracking{u.status ? ` · ${u.status}` : ''}
                </span>
              ) : (
                <Button
                  onClick={() => start(u)}
                  disabled={adding === u.id}
                  className="shrink-0"
                >
                  {adding === u.id ? 'Adding…' : 'Start'}
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      {total > 25 && (
        <div className="flex items-center justify-between">
          <Button
            variant="secondary"
            onClick={() => setOffset((o) => Math.max(0, o - 25))}
            disabled={offset === 0 || loading}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-400">
            {offset + 1}–{Math.min(offset + 25, total)} of {total}
          </span>
          <Button
            variant="secondary"
            onClick={() => setOffset((o) => o + 25)}
            disabled={offset + 25 >= total || loading}
          >
            Next
          </Button>
        </div>
      )}

      <p className="text-xs text-gray-500">
        Ayah counts and groupings derive from the{' '}
        <a
          href="https://tanzil.net"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gold-400 hover:underline"
        >
          Tanzil
        </a>{' '}
        Uthmani text (CC-BY).
      </p>
    </div>
  );
}
