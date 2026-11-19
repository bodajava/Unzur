import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LEGAL_SLUGS, LEGAL_UPDATED, legal, type LegalSlug } from "@/content/legal";
import { alternatesFor, localePath } from "@/i18n/config";
import { fmt, formatDate } from "@/i18n/format";
import { getDictionary, getLang } from "@/i18n/server";

type Props = PageProps<"/[lang]/legal/[slug]">;

const isSlug = (s: string): s is LegalSlug => (LEGAL_SLUGS as readonly string[]).includes(s);

export async function generateStaticParams() {
  return LEGAL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const [{ slug }, lang] = await Promise.all([props.params, getLang()]);
  if (!isSlug(slug)) return {};
  const doc = legal[lang][slug];
  return { title: doc.title, description: doc.summary, alternates: alternatesFor(lang, `/legal/${slug}`) };
}

/** Returns, shipping, privacy and terms: one readable column, the four linked at the top. */
export default async function LegalPage(props: Props) {
  const [{ slug }, lang] = await Promise.all([props.params, getLang()]);
  if (!isSlug(slug)) notFound();
  const t = await getDictionary(lang);
  const doc = legal[lang][slug];

  return (
    <section className="bg-page px-6 pt-32 pb-28 sm:px-10 sm:pt-40 lg:px-14">
      <article className="mx-auto max-w-3xl">
        <nav aria-label={t.footer.policies} className="flex flex-wrap gap-2 text-sm">
          {LEGAL_SLUGS.map((s) => (
            <Link
              key={s}
              href={localePath(lang, `/legal/${s}`)}
              aria-current={s === slug ? "page" : undefined}
              className={`rounded-full px-3.5 py-1.5 transition-colors ${
                s === slug ? "bg-ink text-page" : "border border-ink/15 hover:border-ink/40"
              }`}
            >
              {t.footer[s]}
            </Link>
          ))}
        </nav>

        <h1 className="display mt-10 text-[clamp(2.4rem,6vw,4.5rem)]">{doc.title}</h1>
        <p className="mt-4 text-lg text-muted">{doc.summary}</p>
        <p className="mt-3 text-xs text-muted">{fmt(t.legal.updated, { date: formatDate(LEGAL_UPDATED, lang) })}</p>

        <div className="mt-12 space-y-10">
          {doc.sections.map((sec) => (
            <section key={sec.heading}>
              <h2 className="text-xl font-semibold">{sec.heading}</h2>
              {sec.body.map((p) => (
                <p key={p} className="mt-3 leading-relaxed">
                  {p}
                </p>
              ))}
              {sec.list && (
                <ul className="mt-3 list-disc space-y-2 ps-5 leading-relaxed marker:text-muted">
                  {sec.list.map((li) => (
                    <li key={li}>{li}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <p className="mt-16 border-t border-ink/12 pt-8 text-sm text-muted">
          {t.legal.questions}{" "}
          <Link href={localePath(lang, "/contact")} className="nav-link font-semibold text-ink">
            {t.legal.contact} {t.common.arrow}
          </Link>
        </p>
      </article>
    </section>
  );
}
