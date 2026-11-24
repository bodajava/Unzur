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
  // The hero is English on every page, so its words are too.
  const words = categories.length ? [...categories.map((c) => c.name), "Pieces"] : [];

  const egp = (piasters: number) => (piasters / 100).toFixed(2);
  const productEntries = products.map((p) => {
    const url = `${site.url}${localePath(lang, `/products/${p.slug}`)}`;
    const productId = `${url}#product`;
    const prices = p.variants?.length
      ? p.variants.map((v) => v.salePrice ?? v.price)
      : [p.salePrice ?? p.basePrice];
    const minPrice = egp(Math.min(...prices));
    const maxPrice = egp(Math.max(...prices));
    const inStock = p.variants?.length ? p.variants.some((v) => v.stock > 0) : p.stock > 0;
    const availability = `https://schema.org/${inStock ? "InStock" : "OutOfStock"}`;

    const offers =
      prices.length > 1
        ? {
            "@type": "AggregateOffer",
            priceCurrency: site.currency,
            lowPrice: minPrice,
            highPrice: maxPrice,
            offerCount: prices.length,
            availability,
            url,
          }
        : {
            "@type": "Offer",
            priceCurrency: site.currency,
            price: minPrice,
            availability,
            url,
          };

    const productNode = {
      "@type": "Product",
      "@id": productId,
      name: p.name,
      url,
      ...(p.primaryImage ? { image: p.primaryImage.url } : {}),
      ...(p.shortDescription ? { description: p.shortDescription } : {}),
      brand: { "@type": "Brand", name: p.brand?.name ?? site.name },
      offers,
    };

    const offerNode = {
      "@type": "Offer",
      "@id": `${url}#offer`,
      name: p.name,
      price: minPrice,
      priceCurrency: site.currency,
      availability,
      url,
      seller: { "@id": `${site.url}/#organization` },
      itemOffered: { "@id": productId },
    };

    return { p, url, productId, productNode, offerNode };
  });

  return (
    <>
      <JsonLd
        data={[
          {
            "@type": "ItemList",
            name: t.meta.bestSellersList,
            inLanguage: lang,
            itemListElement: productEntries.map(({ p, url, productId }, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url,
              name: p.name,
              item: { "@id": productId },
            })),
          },
          ...productEntries.map((e) => e.productNode),
          ...productEntries.map((e) => e.offerNode),
        ]}
      />
      <Hero words={words} />
      <Pieces products={products} />
      {band && <Marquee items={band} tone="blue" />}
      <Concept />
      <Collections categories={categories} />
    </>
  );
}
