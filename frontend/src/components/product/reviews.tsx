import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { fmt, formatDate, plural } from "@/i18n/format";
import type { ReviewPage } from "@/lib/api/types";

function Stars({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={label}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} viewBox="0 0 20 20" className={`size-4 ${i < Math.round(value) ? "text-ink" : "text-ink/20"}`} aria-hidden>
          <path fill="currentColor" d="m10 1.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.6 7.7l5.8-.8L10 1.6Z" />
        </svg>
      ))}
    </span>
  );
}

/** Approved reviews (first page) with the rating summary. */
export function Reviews({ lang, t, page }: { lang: Locale; t: Dictionary; page: ReviewPage | null }) {
  const summary = page?.ratingSummary;
  const total = summary?.totalReviews ?? 0;
  return (
    <section aria-labelledby="reviews-title" className="mt-24 grid gap-10 border-t border-ink/15 pt-12 lg:mt-32 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <h2 id="reviews-title" className="display text-[clamp(1.8rem,4vw,3rem)]">
          {t.reviews.title}
        </h2>
        {total > 0 && summary?.averageRating != null && (
          <div className="mt-5">
            <p className="text-4xl tabular-nums">{summary.averageRating.toFixed(1)}</p>
            <Stars value={summary.averageRating} label={fmt(t.reviews.outOf, { rating: summary.averageRating.toFixed(1) })} />
            <p className="mt-1 text-sm text-muted">{plural(lang, t.reviews.count, total)}</p>
          </div>
        )}
      </div>
      <div className="lg:col-span-8">
        {total === 0 || !page ? (
          <p className="max-w-lg text-muted">{t.reviews.none}</p>
        ) : (
          <ul className="divide-y divide-ink/12">
            {page.items.map((r) => (
              <li key={r.id} className="py-6 first:pt-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Stars value={r.rating} label={fmt(t.reviews.outOf, { rating: r.rating })} />
                  <span className="text-sm font-semibold">{r.reviewerName}</span>
                  {r.verifiedPurchase && <span className="eyebrow text-[0.65rem] text-muted">{t.reviews.verified}</span>}
                  <time dateTime={r.createdAt} className="text-xs text-muted">
                    {formatDate(r.createdAt, lang)}
                  </time>
                </div>
                {r.title && <p className="mt-3 font-semibold">{r.title}</p>}
                {r.comment && <p className="mt-1.5 leading-relaxed text-ink/85">{r.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
