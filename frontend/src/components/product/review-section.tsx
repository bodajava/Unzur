"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt, formatDate, plural } from "@/i18n/format";
import { ApiError } from "@/lib/api/client";
import { reviewsApi } from "@/lib/api/endpoints";
import { errorMessage } from "@/lib/api/errors";
import { useSession } from "@/lib/api/hooks";
import type { Review, ReviewPage } from "@/lib/api/types";

const STAR = "m10 1.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.6 7.7l5.8-.8L10 1.6Z";
const MAX_PHOTOS = 4;
const PAGE = 6;

export function Stars({ value, label, size = "size-4" }: { value: number; label: string; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={label}>
      {Array.from({ length: 5 }, (_, i) => {
        // Partial fill for averages like 4.3: the 5th star is 30% blue.
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <svg key={i} viewBox="0 0 20 20" className={`${size} text-ink/15`} aria-hidden>
            <defs>
              <clipPath id={`s${i}-${Math.round(fill * 100)}`}>
                <rect width={20 * fill} height="20" />
              </clipPath>
            </defs>
            <path fill="currentColor" d={STAR} />
            <path className="text-blue" fill="currentColor" d={STAR} clipPath={`url(#s${i}-${Math.round(fill * 100)})`} />
          </svg>
        );
      })}
    </span>
  );
}

/** Five buttons as a radio group: 1-5 stars. */
function StarPicker({ value, onChange, invalid }: { value: number; onChange: (n: number) => void; invalid: boolean }) {
  const { lang, t } = useI18n();
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div role="radiogroup" aria-label={t.reviews.yourRating} aria-invalid={invalid} className="flex gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={plural(lang, t.reviews.starLabel, n)}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n)}
          className="rounded-md p-0.5 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-blue"
        >
          <svg viewBox="0 0 20 20" className={`size-8 ${n <= shown ? "text-blue" : invalid ? "text-[#d1342f]/30" : "text-ink/20"}`} aria-hidden>
            <path fill="currentColor" d={STAR} />
          </svg>
        </button>
      ))}
    </div>
  );
}

function ReviewForm({ productId, onDone }: { productId: string; onDone: (published: boolean) => void }) {
  const { t } = useI18n();
  const tr = t.reviews;
  const uid = useId();
  const client = useQueryClient();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [tried, setTried] = useState(false);
  const previews = useMemo(() => photos.map((p) => URL.createObjectURL(p)), [photos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const post = useMutation({
    mutationFn: () => reviewsApi.create(productId, { rating, title: title.trim() || undefined, comment: comment.trim() || undefined }, photos),
    onSuccess: async (review) => {
      await client.invalidateQueries({ queryKey: ["reviews", productId] });
      onDone((review as Review & { isApproved?: boolean }).isApproved !== false);
    },
  });
  const already = post.error instanceof ApiError && post.error.status === 409;
  const field = "mt-1.5 w-full rounded-xl border border-ink/20 bg-transparent px-3.5 py-2.5 text-base focus:border-ink focus:outline-none";

  return (
    <form
      noValidate
      className="mt-6 space-y-5 rounded-2xl bg-panel p-5 sm:p-6 dark:ring-1 dark:ring-white/8"
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (rating < 1) return;
        post.mutate();
      }}
    >
      <div>
        <p className="text-sm font-semibold">{tr.yourRating}</p>
        <div className="mt-2">
          <StarPicker value={rating} onChange={setRating} invalid={tried && rating < 1} />
        </div>
        {tried && rating < 1 && <p className="mt-1 text-xs text-[#d1342f]">{tr.pickRating}</p>}
      </div>
      <label className="block text-sm font-semibold">
        {tr.titleField}
        <input dir="auto" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
      </label>
      <label className="block text-sm font-semibold">
        {tr.comment}
        <textarea
          dir="auto"
          rows={4}
          maxLength={2000}
          placeholder={tr.commentPlaceholder}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className={`${field} resize-y placeholder:text-ink/40`}
        />
      </label>
      <div>
        <p className="text-sm font-semibold">{tr.photos}</p>
        <div className="mt-2 flex flex-wrap gap-3">
          {previews.map((src, i) => (
            <div key={src} className="relative size-20 overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview (blob URL) */}
              <img src={src} alt="" className="size-full object-cover" />
              <button
                type="button"
                aria-label={tr.removePhoto}
                onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                className="absolute top-1 grid size-6 place-items-center rounded-full bg-ink/70 text-xs text-page ltr:right-1 rtl:left-1"
              >
                ×
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <label htmlFor={`${uid}-photos`} className="grid size-20 cursor-pointer place-items-center rounded-xl border border-dashed border-ink/30 text-center text-xs text-muted hover:border-ink">
              <span>
                <span className="block text-xl leading-none">+</span>
                {tr.addPhotos}
              </span>
            </label>
          )}
          <input
            id={`${uid}-photos`}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              setPhotos((p) => [...p, ...picked].slice(0, MAX_PHOTOS));
              e.target.value = "";
            }}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={post.isPending} className="rounded-full bg-blue px-7 py-3 font-semibold text-haze transition-colors hover:bg-blue-deep disabled:opacity-60">
          {post.isPending ? tr.posting : tr.submit}
        </button>
        <p role="alert" className="text-sm text-[#d1342f]">
          {already ? tr.already : post.isError ? errorMessage(post.error, t) : ""}
        </p>
      </div>
    </form>
  );
}

/** Full-screen photo viewer with previous / next. */
function Lightbox({ photos, start, onClose }: { photos: string[]; start: number; onClose: () => void }) {
  const { t } = useI18n();
  const [i, setI] = useState(start);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((n) => (n + 1) % photos.length);
      if (e.key === "ArrowLeft") setI((n) => (n - 1 + photos.length) % photos.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, photos.length]);
  return (
    <div role="dialog" aria-modal="true" aria-label={fmt(t.reviews.photo, { n: i + 1, total: photos.length })} className="fixed inset-0 z-[70] grid place-items-center bg-[#05060f]/90 p-4" onClick={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element -- customer photo, any size */}
      <img src={photos[i]} alt="" className="max-h-[85svh] max-w-full rounded-2xl object-contain" onClick={(e) => e.stopPropagation()} />
      <button type="button" onClick={onClose} aria-label={t.reviews.close} className="absolute top-5 text-3xl text-haze ltr:right-6 rtl:left-6">
        ×
      </button>
      {photos.length > 1 && (
        <p dir="ltr" className="absolute bottom-6 text-sm text-haze/80 tabular-nums">
          {i + 1} / {photos.length}
        </p>
      )}
    </div>
  );
}

function ReviewCard({ r }: { r: Review }) {
  const { lang, t } = useI18n();
  const [open, setOpen] = useState<number | null>(null);
  return (
    <li className="break-inside-avoid rounded-2xl bg-panel p-5 dark:ring-1 dark:ring-white/8">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-blue text-sm font-semibold text-haze">
            {r.reviewerName.charAt(0)}
          </span>
          <div>
            <p className="text-sm font-semibold">{r.reviewerName}</p>
            <p className="text-xs text-muted">
              <time dateTime={r.createdAt}>{formatDate(r.createdAt, lang)}</time>
              {r.verifiedPurchase && <span className="ms-2 text-[#16773f] dark:text-[#7ee2a8]">✓ {t.reviews.verified}</span>}
            </p>
          </div>
        </div>
        <Stars value={r.rating} label={fmt(t.reviews.outOf, { rating: r.rating })} />
      </div>
      {r.title && (
        <p dir="auto" className="mt-4 font-semibold">
          {r.title}
        </p>
      )}
      {r.comment && (
        <p dir="auto" className="mt-1.5 leading-relaxed text-ink/85">
          {r.comment}
        </p>
      )}
      {r.images?.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {r.images.map((src, i) => (
            <button key={src} type="button" onClick={() => setOpen(i)} aria-label={fmt(t.reviews.photo, { n: i + 1, total: r.images.length })} className="size-20 overflow-hidden rounded-xl transition-transform hover:scale-[1.04]">
              {/* eslint-disable-next-line @next/next/no-img-element -- customer photo thumbnail */}
              <img src={src} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {open !== null && <Lightbox photos={r.images} start={open} onClose={() => setOpen(null)} />}
    </li>
  );
}

/**
 * Reviews on the product page: rating summary with a bar per star count,
 * customer photos, and a form (signed-in customers) to add one.
 */
export function ReviewSection({ productId, initial }: { productId: string; initial: ReviewPage | null }) {
  const { lang, t, href } = useI18n();
  const tr = t.reviews;
  const { isSignedIn } = useSession();
  const [limit, setLimit] = useState(PAGE);
  const [writing, setWriting] = useState(false);
  const [thanks, setThanks] = useState<string | null>(null);
  const reviews = useQuery({
    queryKey: ["reviews", productId, limit],
    queryFn: () => reviewsApi.list(productId, { page: 1, limit }),
    initialData: limit === PAGE && initial ? initial : undefined,
    placeholderData: (prev) => prev,
  });
  const page = reviews.data ?? initial;
  const summary = page?.ratingSummary;
  const total = summary?.totalReviews ?? 0;

  return (
    <section id="reviews" aria-labelledby="reviews-title" className="mt-24 scroll-mt-28 border-t border-ink/15 pt-12 lg:mt-32">
      <div className="grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <h2 id="reviews-title" className="display text-[clamp(1.8rem,4vw,3rem)]">
            {tr.title}
          </h2>
          {total > 0 && summary?.averageRating != null && (
            <div className="mt-6">
              <p className="flex items-baseline gap-2">
                <span className="text-6xl font-semibold tabular-nums">{summary.averageRating.toFixed(1)}</span>
                <span className="text-muted">/ 5</span>
              </p>
              <div className="mt-2">
                <Stars value={summary.averageRating} size="size-5" label={fmt(tr.outOf, { rating: summary.averageRating.toFixed(1) })} />
              </div>
              <p className="mt-1 text-sm text-muted">{plural(lang, tr.count, total)}</p>
              <ul className="mt-6 space-y-2">
                {summary.breakdown.map((b) => (
                  <li key={b.stars} className="flex items-center gap-3 text-sm">
                    <span className="w-6 tabular-nums">{b.stars}★</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink/10">
                      <span className="block h-full rounded-full bg-blue" style={{ width: `${total ? (b.count / total) * 100 : 0}%` }} />
                    </span>
                    <span className="w-8 text-end text-muted tabular-nums">{b.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-8">
            {isSignedIn ? (
              !writing &&
              !thanks && (
                <button type="button" onClick={() => setWriting(true)} className="rounded-full bg-blue px-6 py-3 font-semibold text-haze transition-colors hover:bg-blue-deep">
                  {tr.write}
                </button>
              )
            ) : (
              <Link href={href("/account")} className="inline-block rounded-full border border-ink/25 px-6 py-3 text-sm font-semibold hover:border-ink">
                {tr.signIn}
              </Link>
            )}
            {thanks && (
              <p role="status" className="mt-2 text-sm font-semibold text-[#16773f] dark:text-[#7ee2a8]">
                {thanks}
              </p>
            )}
          </div>
        </div>

        <div className="lg:col-span-8">
          {writing && (
            <ReviewForm
              productId={productId}
              onDone={(published) => {
                setWriting(false);
                setThanks(published ? tr.thanks : tr.thanksPending);
              }}
            />
          )}
          {total === 0 || !page ? (
            !writing && <p className="max-w-lg text-muted">{tr.none}</p>
          ) : (
            <>
              <ul className={`gap-4 space-y-4 sm:columns-2 ${writing ? "mt-8" : ""}`}>
                {page.items.map((r) => (
                  <ReviewCard key={r.id} r={r} />
                ))}
              </ul>
              {page.meta.hasNextPage && (
                <button type="button" onClick={() => setLimit((l) => l + PAGE)} disabled={reviews.isFetching} className="nav-link mt-6 text-sm disabled:opacity-50">
                  {tr.showMore} {t.common.arrow}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
