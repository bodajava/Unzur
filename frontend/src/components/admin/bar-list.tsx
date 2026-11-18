import type { ReactNode } from "react";

export interface BarRow {
  key: string;
  label: ReactNode;
  /** Sets the bar length (relative to the largest row). */
  value: number;
  /** What the reader sees, e.g. "12,400 EGP". */
  valueText: string;
  /** Second line under the label, e.g. "18 orders · 32% of sales". */
  sub?: string;
}

/**
 * Ranked horizontal bars: label and value as text, the bar only shows size.
 * One hue (magnitude, not identity). Bars start at the reading edge, so they
 * grow right-to-left in Arabic. The same numbers are in a table for screen readers.
 */
export function BarList({ rows, caption }: { rows: BarRow[]; caption: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <>
      <ul className="space-y-3.5" aria-hidden>
        {rows.map((r) => (
          <li key={r.key} title={[typeof r.label === "string" ? r.label : "", r.valueText, r.sub].filter(Boolean).join(" · ")}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{r.label}</span>
              <span className="shrink-0 font-semibold tabular-nums">{r.valueText}</span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-ink/8">
              <div
                className="h-full rounded-full bg-blue transition-[width] duration-700 ease-float"
                style={{ width: `${Math.max(r.value > 0 ? 1.5 : 0, (r.value / max) * 100)}%` }}
              />
            </div>
            {r.sub && <p className="mt-1 text-xs text-muted tabular-nums">{r.sub}</p>}
          </li>
        ))}
      </ul>
      <div className="sr-only">
        <table>
          <caption>{caption}</caption>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row">{r.label}</th>
                <td>{r.valueText}</td>
                {r.sub && <td>{r.sub}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
