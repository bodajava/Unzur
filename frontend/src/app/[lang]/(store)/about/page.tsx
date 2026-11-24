import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/ui/json-ld";
import { alternatesFor, localePath } from "@/i18n/config";
import { getDictionary, getLang } from "@/i18n/server";
import { getCategories, getPublicSettings } from "@/lib/api/server";
import { contactInfo } from "@/lib/contact-info";
import { site } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  const isAr = lang === "ar";
  return {
    title: isAr ? "عن أنظر" : "About UNZUR",
    description: isAr ? site.descriptionAr : site.description,
    alternates: alternatesFor(lang, "/about"),
  };
}

export default async function AboutPage() {
  const lang = await getLang();
  const [t, categories, settings] = await Promise.all([
    getDictionary(lang),
    getCategories(),
    getPublicSettings(),
  ]);
  const c = contactInfo(settings);
  const email = c.email ?? site.email;
  const phone = c.phone ?? site.phone;
  const url = `${site.url}${localePath(lang, "/about")}`;

  return (
    <section className="bg-page px-6 pt-32 pb-28 sm:px-10 sm:pt-40 lg:px-14">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: `${t.footer.about} — ${site.name}`,
          url,
          description: t.meta.description,
          mainEntity: { "@id": `${site.url}/#organization` },
        }}
      />

      <div className="mx-auto max-w-5xl">
        <p className="eyebrow text-muted">{site.name} · {site.address.locality}, {site.address.countryName}</p>
        <h1 className="display mt-4 text-[clamp(2.6rem,7vw,5.5rem)]">{t.footer.about}</h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink/85">{t.concept.intro}</p>

        <div className="mt-14 border-t border-ink/12 pt-12">
          <p lang="ar" dir="rtl" className="text-[clamp(1.25rem,2.4vw,2rem)] font-medium leading-[1.8] text-ink">
            {t.concept.body}
          </p>
          <p lang="ar" dir="rtl" className="mt-6 text-xl font-semibold text-ink">
            {t.common.tagline}
          </p>
        </div>

        <div className="mt-16 grid gap-6 border-t border-ink/12 pt-12 sm:grid-cols-3">
          <div className="rounded-2xl border border-ink/12 p-6">
            <h2 className="eyebrow text-muted">Studio</h2>
            <p className="mt-3 text-base font-semibold">
              {site.address.locality}, {site.address.countryName}
            </p>
            <p className="mt-1.5 text-sm text-muted">
              Nationwide delivery across all 27 Egyptian governorates. Prices listed in {site.currency}.
            </p>
          </div>

          <div className="rounded-2xl border border-ink/12 p-6">
            <h2 className="eyebrow text-muted">Collections</h2>
            <ul className="mt-3 space-y-1.5 text-sm">
              {categories.length ? (
                categories.map((cat) => (
                  <li key={cat.id}>
                    <Link href={localePath(lang, `/category/${cat.slug}`)} className="nav-link">
                      {cat.name}
                    </Link>
                  </li>
                ))
              ) : (
                <li>
                  <Link href={localePath(lang, "/shop")} className="nav-link">
                    {t.footer.allPieces}
                  </Link>
                </li>
              )}
            </ul>
          </div>

          <div className="rounded-2xl border border-ink/12 p-6">
            <h2 className="eyebrow text-muted">Contact</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a href={`mailto:${email}`} dir="ltr" className="nav-link break-all">
                  {email}
                </a>
              </li>
              <li>
                <a href={c.tel ?? `tel:${phone.replace(/[^\d+]/g, "")}`} dir="ltr" className="nav-link tabular-nums">
                  {phone}
                </a>
              </li>
              <li>
                <Link href={localePath(lang, "/contact")} className="nav-link">
                  {t.footer.contact} {t.common.arrow}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap gap-4">
          <Link
            href={localePath(lang, "/shop")}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-page transition-opacity hover:opacity-85"
          >
            {t.pieces.shopAll} {t.common.arrow}
          </Link>
          <Link
            href={localePath(lang, "/contact")}
            className="inline-flex items-center gap-2 rounded-full border border-ink/25 px-6 py-3 text-sm font-semibold transition-colors hover:border-ink"
          >
            {t.footer.contact}
          </Link>
        </div>
      </div>
    </section>
  );
}
