import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getDictionary, getLang } from "@/i18n/server";
import { getCategories, getPublicSettings } from "@/lib/api/server";
import { marqueeLines } from "@/lib/promo";
import { PrizeWheel } from "@/components/promo/prize-wheel";

/** The storefront: floating glass header, page, footer. */
export default async function StoreLayout({ children }: LayoutProps<"/[lang]">) {
  const lang = await getLang();
  const [categories, settings, t] = await Promise.all([getCategories(), getPublicSettings(), getDictionary(lang)]);
  const marquee = marqueeLines(settings.marquee_top, lang, t.nav.marquee);
  return (
    <>
      <SiteHeader categories={categories} marquee={marquee} />
      <main id="main">{children}</main>
      <SiteFooter />
      <PrizeWheel />
    </>
  );
}
