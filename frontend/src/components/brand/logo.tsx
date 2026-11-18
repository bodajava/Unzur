"use client";

import { useId } from "react";
import { BALL, LETTERS, LOGO_BOX, OPENING, PUPIL } from "./logo-paths";

export { LOGO_BOX, PUPIL } from "./logo-paths";

/**
 * The eye: a disc with an almond-shaped opening cut out of it, and a pupil.
 * `[data-lid]` (the opening) blinks by scaling to 0; `[data-pupil]` looks around.
 */
function EyeParts({ maskId }: { maskId: string }) {
  return (
    <g data-eye>
      <mask id={maskId} maskUnits="userSpaceOnUse" x="300" y="0" width="100" height="72">
        <rect x="300" y="0" width="100" height="72" fill="#fff" />
        <path data-lid d={OPENING} fill="#000" />
      </mask>
      <path d={BALL} mask={`url(#${maskId})`} />
      <circle data-pupil cx={PUPIL.x} cy={PUPIL.y} r="12" />
    </g>
  );
}

function useMaskId() {
  return `eye${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

interface MarkProps {
  className?: string;
  /** Accessible name; omit when the mark is decorative or a parent link is labelled. */
  title?: string;
  /** Slow CSS blink + glance. Off where GSAP drives the eye. */
  idle?: boolean;
}

/** The full UNZUR wordmark. Fills with `currentColor`. */
export function Logo({ className, title, idle = false }: MarkProps) {
  const maskId = useMaskId();
  return (
    <svg
      viewBox={`0 0 ${LOGO_BOX.width} ${LOGO_BOX.height}`}
      fill="currentColor"
      className={`${idle ? "logo-idle " : ""}${className ?? ""}`}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {LETTERS.map((d, i) => (
        <path key={i} data-letter d={d} fillRule="evenodd" />
      ))}
      <g data-letter>
        <EyeParts maskId={maskId} />
      </g>
    </svg>
  );
}

/** The eye on its own (the brand icon). */
export function EyeMark({ className, title, idle = false }: MarkProps) {
  const maskId = useMaskId();
  return (
    <svg
      viewBox="313 0 74 71"
      fill="currentColor"
      className={`${idle ? "logo-idle " : ""}${className ?? ""}`}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <EyeParts maskId={maskId} />
    </svg>
  );
}
