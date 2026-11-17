import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Reveal } from "@/components/ui/reveal";
import { localePath } from "@/i18n/config";
import { getDictionary, getLang } from "@/i18n/server";
import { NewsletterForm } from "./newsletter-form";

export async function SiteFooter() {
  const lang = await getLang();
  const t = await getDictionary(lang);
  return (
    <footer className="overflow-hidden bg-page px-6 pt-24 text-ink sm:px-10 lg:px-14">
      <Reveal className="mx-auto grid max-w-[90rem] gap-12 border-t border-ink/15 pt-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div data-reveal className="max-w-sm">
          <h2 className="text-sm font-semibold">{t.newsletter.title}</h2>
          <p className="mt-2 text-sm text-muted">{t.newsletter.blurb}</p>
          <div className="mt-5">
            <NewsletterForm />
          </div>
        </div>
        {t.footer.columns.map((col) => (
          <nav key={col.title} data-reveal aria-label={col.title}>
            <h2 className="text-sm font-semibold">{col.title}</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={localePath(lang, l.href)} className="nav-link">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </Reveal>

      <div className="mx-auto mt-20 flex max-w-[90rem] flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <span>{t.footer.rights}</span>
        <span lang={lang === "ar" ? "en" : "ar"}>{lang === "ar" ? "Look, or stop looking" : "انظر أو كُفّ عن النظر"}</span>
      </div>
      <Logo idle className="mx-auto mt-8 block h-auto w-full max-w-[90rem] text-ink dark:text-blue dark:drop-shadow-[0_0_40px_rgba(27,68,255,0.45)]" />
    </footer>
  );
}
