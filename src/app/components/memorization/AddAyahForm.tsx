'use client';

// Adds an ayah range to the memorization tracker.
//
// POST /api/memorization/add, migration 0005 and the SM-2 scheduler all worked
// already — nothing in the UI called them, so the entire hifz feature was
// unreachable. This is the missing piece.
//
// Bounds come from src/app/lib/surahs.ts, whose ayah counts were counted from
// the pinned Quran text. The server validates the same rules independently
// (workers/src/lib/memorization-input.ts): the bearer token ships in the JS
// bundle, so anything that can load this form can also post around it.

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { apiFetch, apiErrorMessage, ApiError } from '@/lib/api';
import { SURAHS, ayahCountFor, getSurah } from '@/lib/surahs';

interface AddAyahFormProps {
  onAdded: () => void;
}

export function AddAyahForm({ onAdded }: AddAyahFormProps) {
  const [open, setOpen] = useState(false);
  const [surahId, setSurahId] = useState(1);
  const [ayahFrom, setAyahFrom] = useState('1');
  const [ayahTo, setAyahTo] = useState('1');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const maxAyah = ayahCountFor(surahId);
  const surah = getSurah(surahId);

  /** Null when valid. Mirrors the server's rules so the user sees it sooner. */
  const validate = (): string | null => {
    const from = Number(ayahFrom);
    const to = Number(ayahTo);
    if (!Number.isInteger(from) || !Number.isInteger(to)) {
      return 'Ayah numbers must be whole numbers.';
    }
    if (from < 1) return 'The first ayah must be 1 or greater.';
    if (to < from) return 'The last ayah cannot be before the first.';
    if (to > maxAyah) {
      return `${surah?.name ?? `Surah ${surahId}`} has ${maxAyah} ayah${maxAyah === 1 ? '' : 's'}.`;
    }
    return null;
  };

  const validationError = validate();

  const handleSurahChange = (value: string) => {
    const next = Number(value);
    setSurahId(next);
    // Clamp the range into the new surah instead of leaving it invalid — picking
    // Al-Ikhlas after Al-Baqarah should not strand "255" in the field.
    const limit = ayahCountFor(next);
    setAyahFrom((prev) => String(Math.min(Math.max(Number(prev) || 1, 1), limit)));
    setAyahTo((prev) => String(Math.min(Math.max(Number(prev) || 1, 1), limit)));
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch('/api/memorization/add', {
        method: 'POST',
        body: JSON.stringify({
          surahId,
          ayahFrom: Number(ayahFrom),
          ayahTo: Number(ayahTo),
        }),
      });
      const label =
        ayahFrom === ayahTo
          ? `${surah?.name ?? surahId} ${ayahFrom}`
          : `${surah?.name ?? surahId} ${ayahFrom}–${ayahTo}`;
      setSuccess(`Added ${label}. It is due for review tomorrow.`);
      onAdded();
    } catch (err) {
      // 409 is not a failure worth a scary message — the entry is already there.
      if (err instanceof ApiError && err.status === 409) {
        setError('You are already tracking that exact range.');
      } else {
        console.error('Failed to add memorization entry:', err);
        setError(apiErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <Card className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Add an ayah to memorize</h2>
          <p className="text-sm text-gray-400">
            Pick a surah and a range. Reviews are scheduled automatically.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>Add ayah</Button>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Add an ayah to memorize</h2>
          <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>

        <Select
          label="Surah"
          value={String(surahId)}
          onChange={handleSurahChange}
          options={SURAHS.map((s) => ({
            value: String(s.id),
            label: `${s.id}. ${s.name} — ${s.translation} (${s.ayahCount} ayah${s.ayahCount === 1 ? '' : 's'})`,
          }))}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="From ayah"
            type="number"
            min={1}
            max={maxAyah}
            value={ayahFrom}
            onChange={(e) => {
              setAyahFrom(e.target.value);
              setSuccess(null);
            }}
          />
          <Input
            label="To ayah"
            type="number"
            min={1}
            max={maxAyah}
            value={ayahTo}
            onChange={(e) => {
              setAyahTo(e.target.value);
              setSuccess(null);
            }}
          />
        </div>

        <p className="text-sm text-gray-400">
          {surah
            ? `${surah.name} (${surah.arabic}) has ${maxAyah} ayah${maxAyah === 1 ? '' : 's'}.`
            : null}
        </p>

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="text-sm text-leaf-400">
            {success}
          </p>
        )}

        <Button type="submit" disabled={submitting || validationError !== null}>
          {submitting ? 'Adding…' : 'Add to memorization'}
        </Button>
        {validationError && !error && (
          <p className="text-sm text-gray-500">{validationError}</p>
        )}
      </form>
    </Card>
  );
}
