"use client";

import { useI18n } from "@/i18n/client";
import type { DateRange, Granularity } from "@/lib/admin/types";

export type RangeDays = 7 | 30 | 90 | 365;

/** The last `days` days, rounded to the minute so the query key is stable between renders. */
export function rangeOf(days: number): DateRange {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const iso = (d: Date) => new Date(Math.floor(d.getTime() / 60_000) * 60_000).toISOString();
  return { fromDate: iso(from), toDate: iso(to) };
}

/** Enough bars to read, never too many: days up to a month, weeks up to a quarter, then months. */
export const granularityFor = (days: number): Granularity => (days > 120 ? "month" : days > 31 ? "week" : "day");

export function RangePicker({ value, onChange, options }: { value: RangeDays; onChange: (d: RangeDays) => void; options: readonly RangeDays[] }) {
  const { t } = useI18n();
  return (
    <div role="radiogroup" aria-label={t.admin.range.label} className="inline-flex rounded-full border border-ink/20 p-1">
      {options.map((d) => (
        <button
          key={d}
          type="button"
          role="radio"
          aria-checked={value === d}
          onClick={() => onChange(d)}
          className={`rounded-full px-4 py-1.5 text-sm transition-colors ${value === d ? "bg-ink text-canvas" : "hover:bg-ink/8"}`}
        >
          {t.admin.range[`d${d}`]}
        </button>
      ))}
    </div>
  );
}
