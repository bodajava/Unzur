import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { fmt } from "@/i18n/format";
import { listingQuery, type ListingParams } from "./query";

/** Plain links (crawlable): Previous · Page x of y · Next. */
export function Pagination({
  href,
  params,
  totalPages,
  t,
}: {
  href: string;
  params: ListingParams;
  totalPages: number;
  t: Dictionary;
}) {
  if (totalPages <= 1) return null;
  const link = (page: number) => `${href}${listingQuery({ ...params, page })}`;
  const prev = params.page > 1 ? link(params.page - 1) : null;
  const next = params.page < totalPages ? link(params.page + 1) : null;
  const btn = "rounded-full border border-ink/25 px-5 py-2 text-sm transition-colors hover:border-ink";
  return (
    <nav aria-label={t.shop.pagination} className="mt-16 flex items-center justify-between gap-4">
      {prev ? (
        <Link href={prev} rel="prev" className={btn}>
          {t.shop.prev}
        </Link>
      ) : (
        <span />
      )}
      <p className="text-sm text-muted tabular-nums">{fmt(t.shop.pageOf, { page: params.page, total: totalPages })}</p>
      {next ? (
        <Link href={next} rel="next" className={btn}>
          {t.shop.next}
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
