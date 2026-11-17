"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useSearchSuggest } from "@/lib/api/hooks";
import { formatPrice } from "@/lib/format";

/** Search-as-you-type over the catalog (API 16.1). */
export function SearchPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const listId = useId();
  const { data: results, isFetching, isError } = useSearchSuggest(debounced);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 180);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const searching = debounced.trim().length >= 2;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      className="fixed inset-0 z-[60] overflow-y-auto bg-haze/95 px-4 pt-28 backdrop-blur-xl sm:px-10 sm:pt-36"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="mx-auto max-w-4xl">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            if (query.trim()) {
              onClose();
              router.push(`/search?q=${encodeURIComponent(query.trim())}`);
            }
          }}
          className="flex items-end gap-4 border-b-2 border-blue pb-3"
        >
          <label htmlFor="site-search" className="sr-only">
            Search pieces
          </label>
          <input
            ref={input}
            id="site-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pieces"
            autoComplete="off"
            aria-controls={listId}
            className="display w-full bg-transparent text-[clamp(1.75rem,6vw,4rem)] placeholder:text-blue/30 focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
          />
          <button type="button" onClick={onClose} className="nav-link shrink-0 pb-2">
            Close
          </button>
        </form>

        <div id={listId} aria-live="polite" className="mt-6">
          {!searching && <p className="eyebrow text-ash">Type at least 2 letters — English or عربي</p>}
          {searching && isError && <p className="text-ash">Search is not available right now. Try again in a moment.</p>}
          {searching && !isError && results?.length === 0 && !isFetching && (
            <p className="text-ash">No pieces match “{debounced}”. Try another word.</p>
          )}
          <ul className="divide-y divide-blue/10">
            {results?.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/products/${p.slug}`}
                  onClick={onClose}
                  className="group flex items-baseline justify-between gap-6 py-4"
                >
                  <span className="display text-xl transition-transform duration-500 ease-float group-hover:translate-x-2 sm:text-2xl">
                    {p.name}
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-ash">
                    {formatPrice(p.salePrice ?? p.basePrice)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
