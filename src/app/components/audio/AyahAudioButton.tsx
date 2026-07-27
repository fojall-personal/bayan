'use client';

// Plays one ayah's recitation.
//
// Replaces two separate fakes that shipped as features: a 3-second setTimeout in
// ReviewSession and a 5-second one in TajweedViewer, both of which flipped a
// "Playing…" label and played nothing. There is one real implementation now and
// both call sites use it.
//
// State is driven by media EVENTS, not by the play() promise. A first version
// awaited play() and set "playing" afterwards, which left the button stuck on
// "Loading…" and permanently disabled whenever that promise did not settle —
// observed in a hidden tab, where Chrome suspends media. The element's own
// events are authoritative, so the UI cannot get out of step with it.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ayahAudioUrl, DEFAULT_RECITER, type Reciter } from '@/lib/ayah-audio';

interface AyahAudioButtonProps {
  surah: number;
  ayah: number;
  reciter?: Reciter;
  className?: string;
  /**
   * Playback position in milliseconds, or null when nothing is sounding.
   *
   * Reported with requestAnimationFrame rather than the `timeupdate` event: browsers
   * fire timeupdate roughly every 250ms, and a word in a recitation can be shorter
   * than that — بِسْمِ runs 550ms — so a quarter-second granularity would visibly lag
   * or skip words entirely.
   */
  onPositionChange?: (ms: number | null) => void;
}

type State = 'idle' | 'loading' | 'playing' | 'error';

export function AyahAudioButton({
  surah,
  ayah,
  reciter = DEFAULT_RECITER,
  className = '',
  onPositionChange,
}: AyahAudioButtonProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<State>('idle');

  /**
   * The position callback, held in a ref so the audio effect does not depend on it.
   *
   * Listing it as a dependency would satisfy the linter and introduce a real hazard:
   * a caller passing an inline arrow would get a NEW element every render, which
   * means playback restarting constantly. A ref keeps the latest callback without
   * making element creation depend on its identity.
   */
  const positionCb = useRef(onPositionChange);
  positionCb.current = onPositionChange;

  // One element per target ayah. Recreating on change also guarantees the
  // previous recitation stops when the user moves between verses.
  useEffect(() => {
    const el = new Audio();
    el.preload = 'none';

    const onPlaying = () => setState('playing');
    const onWaiting = () => setState('loading');
    const onEnded = () => setState('idle');
    const onError = () => setState('error');
    // Covers pausing via OS media keys as well as our own button.
    const onPause = () => setState((s) => (s === 'playing' ? 'idle' : s));

    // Position reporting, driven by the frame clock so short words are not skipped.
    let frame = 0;
    const tick = () => {
      if (!el.paused && !el.ended) {
        positionCb.current?.(el.currentTime * 1000);
        frame = requestAnimationFrame(tick);
      }
    };
    const startTicking = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(tick);
    };
    const stopTicking = () => {
      cancelAnimationFrame(frame);
      positionCb.current?.(null);
    };
    // `timeupdate` as well as the frame clock, and not as a belt-and-braces flourish.
    //
    // requestAnimationFrame is suspended entirely while the document is hidden —
    // measured at zero frames in 700ms — but audio keeps playing. So a learner who
    // switches tabs mid-recitation would come back to a highlight frozen where it was.
    // timeupdate is an event rather than a frame callback and keeps firing, roughly
    // every 250ms. rAF provides the smoothness when visible; timeupdate provides the
    // correctness when not.
    const onTimeUpdate = () => {
      if (!el.paused && !el.ended) positionCb.current?.(el.currentTime * 1000);
    };

    el.addEventListener('playing', startTicking);
    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('pause', stopTicking);
    el.addEventListener('ended', stopTicking);

    el.addEventListener('playing', onPlaying);
    el.addEventListener('waiting', onWaiting);
    el.addEventListener('ended', onEnded);
    el.addEventListener('error', onError);
    el.addEventListener('pause', onPause);

    audioRef.current = el;
    setState('idle');

    return () => {
      el.pause();
      cancelAnimationFrame(frame);
      el.removeEventListener('playing', startTicking);
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('pause', stopTicking);
      el.removeEventListener('ended', stopTicking);
      el.removeEventListener('playing', onPlaying);
      el.removeEventListener('waiting', onWaiting);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('error', onError);
      el.removeEventListener('pause', onPause);
      el.src = '';
      audioRef.current = null;
    };
  }, [surah, ayah, reciter.id]);

  const handleClick = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;

    if (state === 'playing') {
      el.pause();
      return;
    }

    let url: string;
    try {
      url = ayahAudioUrl(surah, ayah, reciter);
    } catch {
      // An out-of-range reference is a bug, not a network problem. Show it
      // rather than leaving a button that does nothing when pressed.
      setState('error');
      return;
    }

    if (el.src !== url) el.src = url;
    setState('loading');

    // Not awaited: the 'playing' event is what confirms playback. This only
    // catches an outright rejection, e.g. NotAllowedError when the click was not
    // treated as a user gesture.
    el.play().catch(() => setState('error'));
  }, [state, surah, ayah, reciter]);

  const text =
    state === 'playing'
      ? '❚❚ Pause'
      : state === 'loading'
        ? 'Loading…'
        : state === 'error'
          ? 'Unavailable — retry'
          : '▶ Play';

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`${state === 'playing' ? 'Pause' : 'Play'} recitation of surah ${surah}, ayah ${ayah}`}
      className={
        className ||
        'px-4 py-2 bg-leaf-500/20 text-leaf-400 rounded-lg text-sm hover:bg-leaf-500/30 transition-colors'
      }
    >
      {text}
    </button>
  );
}
