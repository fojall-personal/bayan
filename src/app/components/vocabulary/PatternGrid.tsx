'use client';

// Root x wazn — the multiplicative payoff, made visible.
//
// Bayan tracks roots. Arabic is root x pattern: knowing كتب plus Form X lets you
// decode استكتب without ever having met it, and until this screen existed nothing
// in the app could show which forms a learner knows or why that matters. Rows are
// your own known roots, commonest first; columns are every verb form attested
// anywhere in the Quran. A lit cell is a word you could decode without ever having
// met it — that combination genuinely occurs, and you know both halves.
//
// Deliberately NOT a coverage gate: knowing a word never required knowing its
// verb form by name (see GET /api/progress/coverage's own basis string), so this
// screen is a display and a place to mark forms known, not a new AND-condition.

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { apiFetch, apiPost, apiErrorMessage } from '@/lib/api';
import { rootToArabic } from '@/lib/arabic-root';

interface RootRow {
  root: string;
  occurrences: number;
}
interface FormCol {
  verbForm: string;
  occurrences: number;
  known: boolean;
}
interface Cell {
  root: string;
  verbForm: string;
  occurrences: number;
}

export function PatternGrid() {
  const [roots, setRoots] = useState<RootRow[]>([]);
  const [forms, setForms] = useState<FormCol[]>([]);
  const [cells, setCells] = useState<Cell[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{
        data: { roots: RootRow[]; forms: FormCol[]; cells: Cell[] };
      }>('/api/progress/pattern-grid?limit=20');
      setRoots(res.data.roots ?? []);
      setForms(res.data.forms ?? []);
      setCells(res.data.cells ?? []);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleForm = async (form: FormCol) => {
    if (busy) return;
    setBusy(form.verbForm);
    // Optimistic, same pattern as the function-words screen — a toggle that waits
    // a round trip before showing anything feels broken.
    setForms((prev) =>
      prev.map((f) => (f.verbForm === form.verbForm ? { ...f, known: !f.known } : f))
    );
    try {
      const path = `/api/progress/patterns/${encodeURIComponent(form.verbForm)}/known`;
      if (form.known) {
        await apiFetch(path, { method: 'DELETE' });
      } else {
        await apiPost(path, {});
      }
    } catch (err) {
      setError(apiErrorMessage(err));
      setForms((prev) =>
        prev.map((f) => (f.verbForm === form.verbForm ? { ...f, known: form.known } : f))
      );
    }
    setBusy(null);
  };

  if (loading) {
    return (
      <Card className="py-12 text-center">
        <p className="text-ground-300">Loading the pattern grid…</p>
      </Card>
    );
  }

  const cellFor = (root: string, verbForm: string) =>
    cells.find((c) => c.root === root && c.verbForm === verbForm);

  return (
    <div className="page-transition mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl">Root × pattern</h1>
        <p className="mt-1 text-sm text-ground-300">
          {forms.filter((f) => f.known).length} of {forms.length} forms known · a lit
          cell is a word you could decode without ever having met it
        </p>
      </div>

      {error && (
        <Card>
          <p className="mb-3 text-sm text-ground-300">{error}</p>
          <Button variant="secondary" onClick={load}>
            Try again
          </Button>
        </Card>
      )}

      {roots.length === 0 ? (
        <Card>
          <p className="text-sm text-ground-300">
            No known roots yet — this grid fills in as you mark roots known
            elsewhere in the app.
          </p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 bg-ground-900 p-2 text-left text-xs uppercase tracking-label text-ground-400">
                  Root
                </th>
                {forms.map((f) => (
                  <th key={f.verbForm} className="p-1 text-center">
                    <button
                      type="button"
                      onClick={() => toggleForm(f)}
                      disabled={busy === f.verbForm}
                      aria-pressed={f.known}
                      title={`Form ${f.verbForm} — ${f.occurrences.toLocaleString()} occurrences in the Quran. Click to mark ${f.known ? 'unknown' : 'known'}.`}
                      className={`min-w-11 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                        f.known
                          ? 'bg-leaf-500/20 text-leaf-400'
                          : 'bg-ground-800 text-ground-400 hover:bg-ground-700'
                      }`}
                    >
                      {f.verbForm}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roots.map((r) => (
                <tr key={r.root} className="border-t border-ground-800">
                  <td className="sticky left-0 bg-ground-900 p-2">
                    <span className="text-arabic text-lg" dir="rtl" lang="ar">
                      {rootToArabic(r.root)}
                    </span>
                  </td>
                  {forms.map((f) => {
                    const cell = cellFor(r.root, f.verbForm);
                    return (
                      <td key={f.verbForm} className="p-1 text-center">
                        {cell ? (
                          <span
                            className={`inline-flex h-7 w-7 items-center justify-center rounded ${
                              f.known
                                ? 'bg-leaf-500/30 text-leaf-400'
                                : 'bg-gold-500/10 text-gold-400'
                            }`}
                            title={`${r.root} in Form ${f.verbForm} — ${cell.occurrences}× in the Quran`}
                          >
                            ●
                          </span>
                        ) : (
                          <span className="inline-block h-7 w-7" aria-hidden="true" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <p className="text-xs text-ground-400">
        Rows are your {roots.length} commonest known roots. Columns are every verb
        form attested anywhere in the Quran — click a form to mark it known. Green
        cells are combinations you know both halves of; gold cells occur in the
        corpus but the form isn&apos;t marked known yet.
      </p>
    </div>
  );
}
