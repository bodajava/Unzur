import { cacheLife } from "next/cache";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Reveal } from "@/components/ui/reveal";
import { localePath } from "@/i18n/config";
import { fmt, isFallback, localized } from "@/i18n/format";
import { getDictionary, getLang } from "@/i18n/server";
import { getCategories, getPublicSettings } from "@/lib/api/server";
import { contactInfo } from "@/lib/contact-info";
import { NewsletterForm } from "./newsletter-form";

/** The current year, cached for a day (prerendered pages can't read the clock directly). */
async function currentYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

/** Simple outline camera (Instagram's shape, drawn here, no brand asset). */
function CameraIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.4" cy="6.6" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Every link here goes to a real page. Contact details (email, phone,
 * Instagram) come from Dashboard → Store, so they change without a deploy.
 */
export async function SiteFooter() {
  const lang = await getLang();
  // The footer is always Arabic (labels, categories, tagline); its links stay on the visitor's store pages.
  const [t, categories, settings, year] = await Promise.all([getDictionary("ar"), getCategories(), getPublicSettings(), currentYear()]);
  const tf = t.footer;
  const c = contactInfo(settings);
  const link = (href: string) => localePath(lang, href);
  const column = "text-sm font-semibold";

  return (
    <footer lang="ar" dir="rtl" className="overflow-hidden bg-page px-6 pt-24 text-ink sm:px-10 lg:px-14">
      <Reveal className="mx-auto grid max-w-[90rem] gap-12 border-t border-ink/15 pt-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div data-reveal className="max-w-sm">
          <h2 className={column}>{t.newsletter.title}</h2>
          <p className="mt-2 text-sm text-muted">{t.newsletter.blurb}</p>
          <div className="mt-5">
            <NewsletterForm dict={t} />
          </div>
        </div>

        <nav data-reveal aria-label={tf.shop}>
          <h2 className={column}>{tf.shop}</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <Link href={link("/shop")} className="nav-link">
                {tf.allPieces}
              </Link>
            </li>
            {categories.map((cat) => (
              <li key={cat.id}>
                <Link href={link(`/category/${cat.slug}`)} lang={isFallback("ar", cat.nameAr) ? "en" : undefined} className="nav-link">
                  {localized("ar", cat.name, cat.nameAr)}
                </Link>
              </li>
            ))}
            <li>
              <Link href={link("/#pieces")} className="nav-link">
                {t.nav.bestSellers}
              </Link>
            </li>
          </ul>
        </nav>

        <nav data-reveal aria-label={tf.help}>
          <h2 className={column}>{tf.help}</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {[
              ["/about", tf.about],
              ["/contact", tf.contact],
              ["/track", tf.track],
              ["/account", tf.account],
              ["/cart", tf.cart],
              ["/legal/returns", tf.returns],
              ["/legal/shipping", tf.shipping],
              ["/legal/privacy", tf.privacy],
              ["/legal/terms", tf.terms],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={link(href)} className="nav-link">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div data-reveal>
          <h2 className={column}>{tf.reach}</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {c.email && (
              <li>
                <a href={`mailto:${c.email}`} dir="ltr" className="nav-link break-all">
                  {c.email}
                </a>
              </li>
            )}
            {c.phone && c.tel && (
              <li className="flex flex-wrap items-center gap-x-3">
                <a href={c.tel} dir="ltr" className="nav-link tabular-nums">
                  {c.phone}
                </a>
                {c.whatsapp && (
                  <a href={c.whatsapp} target="_blank" rel="noopener noreferrer" className="nav-link text-muted">
                    {tf.whatsapp}
                  </a>
                )}
              </li>
            )}
            {c.instagram && (
              <li>
                <a href={c.instagram} target="_blank" rel="noopener noreferrer" className="nav-link inline-flex items-center gap-2">
                  <CameraIcon />
                  <span>{tf.instagram}</span>
                  {c.instagramHandle && (
                    <span dir="ltr" className="text-muted">
                      {c.instagramHandle}
                    </span>
                  )}
                </a>
              </li>
            )}
            <li>
              <Link href={link("/contact")} className="nav-link">
                {tf.contact} {t.common.arrow}
              </Link>
            </li>
          </ul>
        </div>
      </Reveal>

      <div className="mx-auto mt-20 flex max-w-[90rem] flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <span>{fmt(tf.rights, { year })}</span>
        <span>{t.common.tagline}</span>
      </div>
      <Logo idle className="mx-auto mt-8 block h-auto w-full max-w-[90rem] text-ink dark:text-blue dark:drop-shadow-[0_0_40px_rgba(27,68,255,0.45)]" />
    </footer>
  );
}
