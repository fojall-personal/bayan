'use client';

// Plays one ayah's recitation.
//
// Replaces two separate fakes that shipped as features: a 3-second setTimeout in
// ReviewSession and a 5-second one in TajweedViewer, both of which flipped a
// "Playing…" label and played nothing. There is one real implementation now and
// both call sites use it.

import { useEffect, useRef, useState } from 'react';
import { ayahAudioUrl, DEFAULT_RECITER, type Reciter } from '@/lib/ayah-audio';

interface AyahAudioButtonProps {
  surah: number;
  ayah: number;
  reciter?: Reciter;
  className?: string;
  /** Rendered before the label, e.g. a short caption. */
  label?: string;
}

type State = 'idle' | 'loading' | 'playing' | 'error';

export function AyahAudioButton({
  surah,
  ayah,
  reciter = DEFAULT_RECITER,
  className = '',
  label,
}: AyahAudioButtonProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<State>('idle');

  // Stop and release whenever the target ayah changes, otherwise navigating
  // between verses leaves the previous recitation playing underneath.
  useEffect(() => {
    return () => {
      const el = audioRef.current;
      if (el) {
        el.pause();
        el.src = '';
      }
      audioRef.current = null;
    };
  }, [surah, ayah, reciter.id]);

  const handleClick = async () => {
    if (state === 'playing') {
      audioRef.current?.pause();
      setState('idle');
      return;
    }

    let url: string;
    try {
      url = ayahAudioUrl(surah, ayah, reciter);
    } catch {
      // An out-of-range reference is a bug, not a network problem. Surface it
      // rather than rendering a button that does nothing when pressed.
      setState('error');
      return;
    }

    let el = audioRef.current;
    if (!el) {
      el = new Audio();
      el.preload = 'none';
      el.addEventListener('ended', () => setState('idle'));
      el.addEventListener('error', () => setState('error'));
      audioRef.current = el;
    }

    if (el.src !== url) el.src = url;

    setState('loading');
    try {
      await el.play();
      setState('playing');
    } catch {
      // Autoplay policies reject play() until the user has interacted. This IS
      // a user gesture, so the realistic causes are a network failure or an
      // unsupported codec.
      setState('error');
    }
  };

  const text =
    state === 'playing'
      ? '❚❚ Pause'
      : state === 'loading'
        ? 'Loading…'
        : state === 'error'
          ? 'Unavailable'
          : '▶ Play';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === 'loading'}
      aria-label={`${state === 'playing' ? 'Pause' : 'Play'} recitation of surah ${surah}, ayah ${ayah}`}
      className={
        className ||
        'px-4 py-2 bg-leaf-500/20 text-leaf-400 rounded-lg text-sm hover:bg-leaf-500/30 disabled:opacity-50 transition-colors'
      }
    >
      {label ? `${label} ` : ''}
      {text}
    </button>
  );
}
