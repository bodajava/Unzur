import Link from "next/link";
import { JsonLd } from "@/components/ui/json-ld";
import { site } from "@/lib/site";

export interface Crumb {
  label: string;
  /** Localized path; omit for the current page. */
  href?: string;
  lang?: string;
}

/** Visible trail + BreadcrumbList JSON-LD for search results. */
export function Breadcrumbs({ items, label }: { items: Crumb[]; label: string }) {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: items.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: c.label,
            ...(c.href ? { item: `${site.url}${c.href}` } : {}),
          })),
        }}
      />
      <nav aria-label={label}>
        <ol className="flex flex-wrap items-center gap-2 text-xs text-muted">
          {items.map((c, i) => (
            <li key={i} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden>/</span>}
              {c.href ? (
                <Link href={c.href} lang={c.lang} className="hover:text-ink">
                  {c.label}
                </Link>
              ) : (
                <span aria-current="page" lang={c.lang} className="text-ink">
                  {c.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
