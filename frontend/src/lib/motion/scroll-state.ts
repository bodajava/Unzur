import type Lenis from "lenis";

/**
 * Shared scroll state written by SmoothScroll:
 *  - velocity: smoothed px per frame (the starfield stretches with it)
 *  - lenis: the instance, so overlays can pause page scrolling
 */
export const scrollState: { velocity: number; lenis: Lenis | null } = { velocity: 0, lenis: null };

export function lockScroll(locked: boolean) {
  if (scrollState.lenis) {
    if (locked) scrollState.lenis.stop();
    else scrollState.lenis.start();
  }
  document.documentElement.style.overflow = locked ? "hidden" : "";
}
