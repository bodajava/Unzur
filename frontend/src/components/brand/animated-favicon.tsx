"use client";

import { useEffect } from "react";

/** The tab icon: the brand eye on blue, as an SVG data URL, with the pupil at dx and the lids at `open` (1 = open, 0 = shut). */
function frame(dx: number, open: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1b44ff"/><g transform="translate(32 32) scale(.62) translate(-350 -35.5)" fill="#e8e8e5"><g transform="translate(0 35.5) scale(1 ${open.toFixed(2)}) translate(0 -35.5)"><mask id="o" maskUnits="userSpaceOnUse" x="300" y="0" width="100" height="72"><rect x="300" width="100" height="72" fill="#fff"/><path fill="#000" d="M350 15.21C361.37 15.21 395 24.17 395 35.5C395 46.83 361.37 55.79 350 55.79C338.63 55.79 307 46.83 307 35.5C307 24.17 338.63 15.21 350 15.21Z"/></mask><path mask="url(#o)" d="M350 2C368.78 2 384 17 384 35.5C384 54 368.78 69 350 69C331.22 69 316 54 316 35.5C316 17 331.22 2 350 2Z"/><circle cx="${(350 + dx).toFixed(1)}" cy="35" r="12"/></g></g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** One loop: look ahead, glance left, glance right, back, blink. [pupil dx, lids open] per step. */
const LOOP: [number, number][] = [
  ...Array<[number, number]>(14).fill([0, 1]),
  [-3, 1], [-6, 1], [-9, 1], [-9, 1], [-9, 1], [-9, 1], [-6, 1], [-3, 1],
  [0, 1], [3, 1], [6, 1], [9, 1], [9, 1], [9, 1], [9, 1], [6, 1], [3, 1],
  ...Array<[number, number]>(6).fill([0, 1]),
  [0, 0.55], [0, 0.12], [0, 0.55], [0, 1],
];

/**
 * Makes the browser tab icon a living eye that looks around and blinks.
 * The static favicon.ico / icon.png / icon.svg stay in <head> for search
 * engines and browsers that ignore icon changes (Safari keeps the static one).
 * Off when the visitor prefers reduced motion.
 */
export function AnimatedFavicon() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const frames = LOOP.map(([dx, open]) => frame(dx, open));
    const link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/svg+xml";
    link.href = frames[0];
    document.head.appendChild(link);
    let i = 0;
    const timer = setInterval(() => {
      i = (i + 1) % frames.length;
      link.href = frames[i];
    }, 110);
    return () => {
      clearInterval(timer);
      link.remove();
    };
  }, []);
  return null;
}
