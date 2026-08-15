'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import registry from '../../../../content/grammar/ardt-devices.json';

interface ArdtDevice {
  code: string;
  name: string;
  transliteration: string;
  domainName: string;
  url: string;
}

const DRILLS = [
  { kind: 'fronting', label: 'Taqdīm (fronting)' },
  { kind: 'jinas', label: 'Al-jinās' },
  { kind: 'simile', label: 'Al-tashbīh' },
];

/**
 * The 95 ARDT names as a glossary. No quiz. CC BY 4.0.
 *
 * Three devices have drills: taqdīm, al-jinās, al-tashbīh. The rest are names only.
 */
export function ArdtGlossary() {
  const [open, setOpen] = useState(false);
  const devices = (registry.devices ?? []) as ArdtDevice[];
  return (
    <Card>
      <p className="text-xs uppercase tracking-label text-gold-400">ARDT v{registry.version}</p>
      <h3 className="mt-1 font-display text-xl">Three drills, 95 names</h3>
      <p className="mt-2 text-sm text-ground-300">
        Taqdīm, al-jinās, and al-tashbīh come from data we trust. The other{' '}
        {devices.length - 3} names are a glossary.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {DRILLS.map((d) => (
          <Link
            key={d.kind}
            href={`/grammar?kind=${d.kind}`}
            className="flex min-h-11 touch-manipulation items-center justify-center rounded-md bg-ground-800 px-2 text-center text-sm text-ground-100"
          >
            {d.label}
          </Link>
        ))}
      </div>
      <p className="mt-3 text-xs text-ground-500">
        {registry.licence} ·{' '}
        <a className="underline" href={registry.source} target="_blank" rel="noreferrer">
          Encyclopedia of Arabic Rhetoric
        </a>
      </p>
      <button
        type="button"
        className="mt-3 flex min-h-11 w-full touch-manipulation items-center justify-between text-left text-xs uppercase tracking-label text-ground-400"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{devices.length} names</span>
        <span>{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <ul className="mt-2 max-h-80 space-y-2 overflow-y-auto">
          {devices.map((d) => (
            <li key={d.code} className="text-sm text-ground-200">
              <span className="text-ground-400">{d.code}</span> {d.name}
              {d.transliteration ? ` · ${d.transliteration}` : ''}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

