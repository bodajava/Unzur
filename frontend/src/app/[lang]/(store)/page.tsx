import { localized } from "@/i18n/format";
import { Collections } from "@/components/home/collections";
import { Concept } from "@/components/home/concept";
import { Hero } from "@/components/home/hero";
import { Pieces } from "@/components/home/pieces";
import { JsonLd } from "@/components/ui/json-ld";
import { localePath } from "@/i18n/config";
import { getDictionary, getLang } from "@/i18n/server";
import { getBestSellers, getCategories, getPublicSettings } from "@/lib/api/server";
import { Marquee } from "@/components/layout/marquee";
import { marqueeLines } from "@/lib/promo";
import { site } from "@/lib/site";

export default async function HomePage() {
  const lang = await getLang();
  const [t, products, categories, settings] = await Promise.all([
    getDictionary(lang),
    getBestSellers(8),
    getCategories(),
    getPublicSettings(),
  ]);
  const band = marqueeLines(settings.marquee_bottom, lang, t.nav.marquee);
  const words = categories.length ? [...categories.map((c) => localized(lang, c.name, c.nameAr)), t.pieces.title] : [];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: t.meta.bestSellersList,
          inLanguage: lang,
          itemListElement: products.map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${site.url}${localePath(lang, `/products/${p.slug}`)}`,
            name: localized(lang, p.name, p.nameAr),
          })),
        }}
      />
      <Hero words={words} />
      <Pieces products={products} />
      {band && <Marquee items={band} tone="blue" />}
      <Concept />
      <Collections categories={categories} />
    </>
  );
}
