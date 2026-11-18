"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/*
 * Liquid glass (in the spirit of Apple's material):
 *  - the backdrop is lightly frosted and saturated,
 *  - near the rounded edges it is refracted like a lens: a displacement map
 *    is drawn for the element's exact size and fed to an SVG filter used by
 *    `backdrop-filter` (Chromium only; elsewhere the glass stays frosted),
 *  - a specular rim catches the light and follows the pointer,
 *  - tint and text colour come from CSS variables, so the glass can adapt to
 *    what is underneath (data-tone).
 */

interface Props {
  children: ReactNode;
  className?: string;
  /** Corner radius in px (must match the rounded-* class). */
  radius?: number;
  /** Width of the refracting edge in px. */
  bezel?: number;
  /** Strength of the refraction in px. */
  strength?: number;
  /** What sits underneath: "light" sections, the blue hero, or "auto" (decided by CSS until known). */
  tone?: "auto" | "light" | "blue";
}

/** Can this browser run SVG filters inside backdrop-filter? (Chromium can; Safari/Firefox can't.) */
function supportsRefraction() {
  if (typeof navigator === "undefined" || typeof CSS === "undefined") return false;
  const ua = navigator.userAgent;
  return /Chrome\/\d+/.test(ua) && !/Firefox|FxiOS|CriOS/.test(ua) && CSS.supports("backdrop-filter", "blur(1px)");
}

/**
 * Displacement map for a rounded rectangle: neutral grey (no shift) in the
 * middle; along the bezel, R/G push sampling inward with a convex falloff.
 */
function displacementMap(width: number, height: number, radius: number, bezel: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(width, height);
  const hx = width / 2;
  const hy = height / 2;
  const r = Math.min(radius, hx, hy);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = x + 0.5 - hx;
      const py = y + 0.5 - hy;
      const qx = Math.abs(px) - (hx - r);
      const qy = Math.abs(py) - (hy - r);
      // Signed distance to the rounded-rect edge (negative inside) and its outward normal.
      let dist: number;
      let nx: number;
      let ny: number;
      if (qx > 0 && qy > 0) {
        const len = Math.hypot(qx, qy) || 1;
        dist = len - r;
        nx = (qx / len) * Math.sign(px);
        ny = (qy / len) * Math.sign(py);
      } else if (qx > qy) {
        dist = qx - r;
        nx = Math.sign(px);
        ny = 0;
      } else {
        dist = qy - r;
        nx = 0;
        ny = Math.sign(py);
      }
      const inside = -dist;
      let mag = 0;
      if (inside >= 0 && inside < bezel) {
        const t = 1 - inside / bezel; // 1 at the rim, 0 where the flat glass starts
        mag = t * t * (3 - 2 * t); // smooth convex falloff
      }
      const i = (y * width + x) * 4;
      img.data[i] = 128 - nx * mag * 127;
      img.data[i + 1] = 128 - ny * mag * 127;
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

export function LiquidGlass({ children, className = "", radius = 14, bezel = 16, strength = 36, tone = "auto" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const filterId = `lg${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [map, setMap] = useState<{ url: string; w: number; h: number } | null>(null);

  // Refraction map, redrawn when the glass changes size.
  useEffect(() => {
    const el = ref.current;
    if (!el || !supportsRefraction()) return;
    let frame = 0;
    const draw = () => {
      const w = Math.round(el.offsetWidth);
      const h = Math.round(el.offsetHeight);
      if (!w || !h) return;
      setMap((prev) => (prev && prev.w === w && prev.h === h ? prev : { url: displacementMap(w, h, radius, bezel), w, h }));
    };
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [radius, bezel]);

  // The specular rim turns toward the pointer, like light moving across glass.
  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = el.getBoundingClientRect();
        const angle = Math.atan2(e.clientY - (box.top + box.height / 2), e.clientX - (box.left + box.width / 2));
        el.style.setProperty("--lg-angle", `${Math.round((angle * 180) / Math.PI + 90)}deg`);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div ref={ref} data-tone={tone} className={`glass ${className}`} style={{ borderRadius: radius }}>
      {map && (
        <svg aria-hidden width="0" height="0" className="pointer-events-none absolute">
          <filter
            id={filterId}
            x="0"
            y="0"
            width={map.w}
            height={map.h}
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feImage href={map.url} x="0" y="0" width={map.w} height={map.h} preserveAspectRatio="none" result="map" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale={strength} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
      )}
      <span
        aria-hidden
        className="glass-backdrop"
        style={map ? { backdropFilter: `url(#${filterId}) var(--glass-frost)` } : undefined}
      />
      <span aria-hidden className="glass-tint" />
      <span aria-hidden className="glass-shine" />
      <span aria-hidden className="glass-rim" />
      <div className="relative">{children}</div>
    </div>
  );
}
