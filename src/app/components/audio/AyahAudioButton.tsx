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

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  ayahAudioUrl,
  DEFAULT_RECITER,
  wordSliceShouldStop,
  type Reciter,
} from '@/lib/ayah-audio';

export interface AyahAudioHandle {
  playSlice: (startMs: number, endMs: number) => void;
}

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
  /**
   * Fires on the real `ended` media event — for continuous reading mode, so a
   * caller can advance to the next ayah. Not derived from state; the element's
   * own event is authoritative, same reasoning as every other callback here.
   */
  onEnded?: () => void;
  /**
   * Start playing as soon as this ayah's element is ready, with no click.
   *
   * Verified empirically (2026-08-10 spike, see
   * .hermes/plans/2026-08-10_CONTINUOUS-READ-for-orinth.md) that a `play()` call
   * made from this mount effect — after a client-side route push, not a direct
   * click on this button — survives Chrome's autoplay-with-sound gate, because the
   * click that caused the navigation still counts as the user gesture. Existing
   * click-to-play behaviour (`handleClick`) is completely unaffected when this
   * prop is absent or false.
   */
  autoPlay?: boolean;
}

type State = 'idle' | 'loading' | 'playing' | 'error';

export const AyahAudioButton = forwardRef<AyahAudioHandle, AyahAudioButtonProps>(
  function AyahAudioButton(
    {
      surah,
      ayah,
      reciter = DEFAULT_RECITER,
      className = '',
      onPositionChange,
      onEnded,
      autoPlay = false,
    },
    ref
  ) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<State>('idle');
  const sliceStartMs = useRef<number | null>(null);
  const sliceEndMs = useRef<number | null>(null);

  /**
   * The position/ended callbacks and the autoPlay flag, held in refs so the audio
   * effect does not depend on them.
   *
   * Listing them as dependencies would satisfy the linter and introduce a real
   * hazard: a caller passing an inline arrow would get a NEW element every render,
   * which means playback restarting constantly. Refs keep the latest values
   * without making element creation depend on their identity.
   */
  const positionCb = useRef(onPositionChange);
  positionCb.current = onPositionChange;
  const endedCb = useRef(onEnded);
  endedCb.current = onEnded;
  const autoPlayRef = useRef(autoPlay);
  autoPlayRef.current = autoPlay;

  /**
   * Resolves the URL and calls play() — the one thing both a click and an
   * autoPlay mount need to do. Not awaited, same reasoning as before: the
   * 'playing' event is what confirms real playback, this only catches an
   * outright rejection (e.g. NotAllowedError when the caller was not a user
   * gesture and did not survive to this call — see AyahAudioButtonProps.autoPlay).
   */
  const startPlayback = useCallback(
    (el: HTMLAudioElement) => {
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
      el.play().catch(() => setState('error'));
    },
    [surah, ayah, reciter]
  );
  // Read via a ref inside the mount effect below, same reasoning as positionCb —
  // startPlayback's identity changes whenever the `reciter` object identity does
  // (matching handleClick's existing dependency shape), and the mount effect must
  // NOT tear down and recreate the Audio element for that alone; only an actual
  // surah/ayah/reciter.id change should do that.
  const startPlaybackRef = useRef(startPlayback);
  startPlaybackRef.current = startPlayback;

  // One element per target ayah. Recreating on change also guarantees the
  // previous recitation stops when the user moves between verses.
  useEffect(() => {
    const el = new Audio();
    el.preload = 'none';

    const onPlaying = () => setState('playing');
    const onWaiting = () => setState('loading');
    const handleEnded = () => {
      setState('idle');
      endedCb.current?.();
    };
    const onError = () => setState('error');
    // Covers pausing via OS media keys as well as our own button.
    const onPause = () => setState((s) => (s === 'playing' ? 'idle' : s));

    // Position reporting, driven by the frame clock so short words are not skipped.
    let frame = 0;
    const maybeStopSlice = () => {
      const end = sliceEndMs.current;
      if (end == null) return;
      if (wordSliceShouldStop(el.currentTime * 1000, end)) {
        el.pause();
        sliceStartMs.current = null;
        sliceEndMs.current = null;
      }
    };
    const tick = () => {
      if (!el.paused && !el.ended) {
        maybeStopSlice();
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
      if (!el.paused && !el.ended) {
        maybeStopSlice();
        positionCb.current?.(el.currentTime * 1000);
      }
    };

    el.addEventListener('playing', startTicking);
    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('pause', stopTicking);
    el.addEventListener('ended', stopTicking);

    el.addEventListener('playing', onPlaying);
    el.addEventListener('waiting', onWaiting);
    el.addEventListener('ended', handleEnded);
    el.addEventListener('error', onError);
    el.addEventListener('pause', onPause);

    audioRef.current = el;
    setState('idle');

    // Verified (2026-08-10 spike): a user gesture's activation survives a
    // client-side route push, so this is safe to call unconditionally here
    // rather than requiring a click — see AyahAudioButtonProps.autoPlay.
    if (autoPlayRef.current) startPlaybackRef.current(el);

    return () => {
      el.pause();
      cancelAnimationFrame(frame);
      el.removeEventListener('playing', startTicking);
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('pause', stopTicking);
      el.removeEventListener('ended', stopTicking);
      el.removeEventListener('playing', onPlaying);
      el.removeEventListener('waiting', onWaiting);
      el.removeEventListener('ended', handleEnded);
      el.removeEventListener('error', onError);
      el.removeEventListener('pause', onPause);
      el.src = '';
      audioRef.current = null;
    };
  }, [surah, ayah, reciter.id]);

  const handleClick = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;

    sliceStartMs.current = null;
    sliceEndMs.current = null;

    if (state === 'playing') {
      el.pause();
      return;
    }

    startPlayback(el);
  }, [state, startPlayback]);

  useImperativeHandle(
    ref,
    () => ({
    playSlice(startMs: number, endMs: number) {
      const el = audioRef.current;
      if (!el) return;
      let url: string;
      try {
        url = ayahAudioUrl(surah, ayah, reciter);
      } catch {
        setState('error');
        return;
      }
      if (state === 'playing' && sliceStartMs.current === startMs) {
        el.pause();
        sliceStartMs.current = null;
        sliceEndMs.current = null;
        return;
      }
      sliceStartMs.current = startMs;
      sliceEndMs.current = endMs;
      const seekAndPlay = () => {
        el.currentTime = startMs / 1000;
        setState('loading');
        el.play().catch(() => setState('error'));
      };
      if (el.src !== url) {
        el.src = url;
        el.addEventListener('loadedmetadata', seekAndPlay, { once: true });
        setState('loading');
        return;
      }
      seekAndPlay();
    },
    }),
    [state, surah, ayah, reciter]
  );

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
});
