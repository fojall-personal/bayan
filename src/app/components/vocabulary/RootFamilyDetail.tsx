'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { apiFetch } from '@/lib/api';

interface FamilyMember {
  lemma: string;
  lemmaArabic: string;
  pos: string | null;
  form: string | null;
  aspects: string[];
  occurrences: number;
}

interface FamilyData {
  root: string;
  members: FamilyMember[];
  mastery: { correctAttempts: number; totalAttempts: number; masteryLevel: number };
}

interface RootFamilyDetailProps {
  root: string;
  onBack: () => void;
  onPracticeRoot?: (root: string) => void;
}

/** One row in the family members table. */
function MemberRow({ member }: { member: FamilyMember }) {
  const posLabels: Record<string, string> = { V: 'verb', N: 'noun', ADJ: 'adjective', PN: 'proper noun', P: 'preposition', PRON: 'pronoun' };
  return (
    <div className="border-b border-ground-800 pb-3 last:border-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-arabic text-ground-100" dir="rtl" lang="ar" style={{ fontFamily: 'var(--font-arabic)', lineHeight: 'var(--leading-arabic)' }}>
            {member.lemmaArabic}
          </span>
          <span className="text-ground-300 text-sm">{posLabels[member.pos ?? ''] || member.pos || ''}</span>
          {member.form && (
            <span className="text-xs text-ground-400 bg-ground-800 px-2 py-0.5 rounded">Form {member.form}</span>
          )}
        </div>
        <span className="text-xs text-ground-500">{member.occurrences} occurrence{member.occurrences !== 1 ? 's' : ''}</span>
      </div>
      {member.aspects.length > 0 && (
        <div className="mt-1 flex gap-2">
          {member.aspects.map(a => <span key={a} className="text-xs text-ground-400">{a}</span>)}
        </div>
      )}
    </div>
  );
}

/** Corpus evidence footer. */
function CorpusEvidence({ members }: { members: FamilyMember[] }) {
  const total = members.reduce((s, m) => s + m.occurrences, 0);
  const forms = [...new Set(members.map(m => m.form).filter(Boolean))] as string[];
  return (
    <div className="rounded-lg border border-ground-800 p-4 bg-ground-900">
      <h3 className="text-ground-50 font-semibold mb-2">Corpus Evidence</h3>
      <p className="text-ground-300 text-sm" style={{ fontFamily: 'var(--font-naskh)' }}>
        {total.toLocaleString()} occurrence{total !== 1 ? 's' : ''} across attested forms
      </p>
      {forms.length > 0 && (
        <p className="text-ground-400 text-xs mt-1">Forms: {forms.map(f => `Form ${f}`).join(', ')}</p>
      )}
    </div>
  );
}

/**
 * Expanded view for a single root family.
 *
 * Fetches from /api/vocabulary/root/:root. Shows root header, family members
 * table (corpus-derived verb forms), corpus evidence, and a practice button.
 */
export function RootFamilyDetail({ root, onBack, onPracticeRoot }: RootFamilyDetailProps) {
  const [data, setData] = useState<FamilyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: FamilyData }>(`/api/vocabulary/root/${encodeURIComponent(root)}`);
      setData(res.data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load root family');
    } finally {
      setLoading(false);
    }
  }, [root]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="py-12 text-center text-ground-400">Loading root family...</div>;
  if (error) return <div className="py-12 text-center"><p className="text-error text-sm">{error}</p><Button onClick={onBack} variant="secondary" size="sm" className="mt-4">Go back</Button></div>;
  if (!data) return <div className="py-12 text-center text-ground-400">No family data available for this root.</div>;

  const { root: rootArabic, members, mastery } = data;

  return (
    <div className="space-y-6">
      <Button onClick={onBack} variant="ghost" size="sm" aria-label="Back to all roots">← Back to all roots</Button>

      {/* Root header */}
      <div className="rounded-lg border border-ground-800 p-6 bg-ground-900 text-center space-y-2">
        <div className="text-5xl font-arabic text-gold-400" dir="rtl" lang="ar" style={{ fontFamily: 'var(--font-arabic)', lineHeight: 'var(--leading-arabic)', fontFeatureSettings: 'liga 1, calt 1' }}>
          {rootArabic}
        </div>
        <p className="text-ground-300 text-lg" style={{ fontFamily: 'var(--font-naskh)' }}>
          Core meaning of the family
        </p>
        <div className="flex items-center justify-center gap-4 text-sm text-ground-400">
          <span>{members.length} word{members.length !== 1 ? 's' : ''} in family</span>
          <span>•</span>
          <span>Mastery: {mastery.masteryLevel}/5 ({mastery.correctAttempts}/{mastery.totalAttempts} correct)</span>
        </div>
      </div>

      {/* Family members table */}
      <div className="rounded-lg border border-ground-800 p-4 bg-ground-900">
        <h3 className="text-ground-50 font-semibold mb-4">Family Members</h3>
        {members.length === 0 ? (
          <p className="text-ground-400 text-sm py-4 text-center">No corpus evidence for this root.</p>
        ) : (
          <div className="space-y-3">
            {members.map((m, i) => <MemberRow key={`${m.lemmaArabic}-${m.pos}-${m.form}-${i}`} member={m} />)}
          </div>
        )}
      </div>

      <CorpusEvidence members={members} />

      {onPracticeRoot && (
        <Button onClick={() => onPracticeRoot(root)} variant="primary" size="lg" className="w-full">
          Practice this root
        </Button>
      )}
    </div>
  );
}
