export interface FreeflowRunRef {
  surah: number;
  ayahFrom: number;
  ayahTo: number;
}

/**
 * Given the ayah that just finished, what plays next in a continuous-reading
 * run — or that the run is over.
 *
 * Pure and DOM-free on purpose: this is the one piece of continuous-mode
 * logic that can carry a real unit test in a repo with no component-test
 * harness (see .hermes/plans/2026-08-10_CONTINUOUS-READ-for-orinth.md).
 */
export function nextInRun(
  run: FreeflowRunRef,
  justFinishedAyah: number
): { surah: number; ayah: number; done: boolean } {
  const isLast = justFinishedAyah >= run.ayahTo;
  return {
    surah: run.surah,
    ayah: isLast ? justFinishedAyah : justFinishedAyah + 1,
    done: isLast,
  };
}
