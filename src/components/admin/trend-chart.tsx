"use client";

import { useId } from "react";
import type { Locale } from "@/i18n/config";
import { formatPrice } from "@/i18n/format";
import type { TrendPoint } from "@/lib/admin/types";

/**
 * Revenue per period as bars (SVG, no library). Each bar has a tooltip; the
 * same numbers are in a hidden table for screen readers. Time runs left to
 * right in both languages, like a calendar.
 */
export function TrendChart({ points, lang, label }: { points: TrendPoint[]; lang: Locale; label: string }) {
  const id = useId();
  const W = 720;
  const H = 220;
  const pad = { top: 12, bottom: 28 };
  const max = Math.max(1, ...points.map((p) => p.revenue));
  const slot = W / Math.max(points.length, 1);
  const bar = Math.max(2, Math.min(28, slot * 0.62));
  const day = (period: string) =>
    new Intl.DateTimeFormat(lang === "ar" ? "ar-EG-u-nu-latn" : "en-EG", { day: "numeric", month: "short" }).format(new Date(period));
  const ticks = points.length ? [0, Math.floor((points.length - 1) / 2), points.length - 1] : [];

  return (
    <figure dir="ltr" aria-labelledby={`${id}-cap`}>
      <figcaption id={`${id}-cap`} className="sr-only">
        {label}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-56 w-full" role="img" aria-hidden preserveAspectRatio="none">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1="0"
            x2={W}
            y1={pad.top + (H - pad.top - pad.bottom) * (1 - f)}
            y2={pad.top + (H - pad.top - pad.bottom) * (1 - f)}
            className="stroke-ink/10"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {points.map((p, i) => {
          const h = ((H - pad.top - pad.bottom) * p.revenue) / max;
          return (
            <rect
              key={p.period}
              x={slot * i + (slot - bar) / 2}
              y={H - pad.bottom - Math.max(h, p.revenue > 0 ? 2 : 0)}
              width={bar}
              height={Math.max(h, p.revenue > 0 ? 2 : 0)}
              rx={Math.min(4, bar / 2)}
              className="fill-blue transition-opacity hover:opacity-70"
            >
              <title>{`${day(p.period)} · ${formatPrice(p.revenue, lang)} · ${p.ordersCount}`}</title>
            </rect>
          );
        })}
        <line x1="0" x2={W} y1={H - pad.bottom} y2={H - pad.bottom} className="stroke-ink/25" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-[0.7rem] text-muted tabular-nums" aria-hidden>
        {ticks.map((i) => (
          <span key={i}>{day(points[i].period)}</span>
        ))}
      </div>
      <table className="sr-only">
        <tbody>
          {points.map((p) => (
            <tr key={p.period}>
              <th scope="row">{day(p.period)}</th>
              <td>{formatPrice(p.revenue, lang)}</td>
              <td>{p.ordersCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
