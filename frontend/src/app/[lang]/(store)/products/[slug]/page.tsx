import { isFallback, localized } from "@/i18n/format";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Gallery } from "@/components/product/gallery";
import { PurchasePanel } from "@/components/product/purchase-panel";
import { RecentlyViewed } from "@/components/product/recently-viewed";
import { ReviewSection } from "@/components/product/review-section";
import { TrackView } from "@/components/product/track-view";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { ProductGrid } from "@/components/shop/product-grid";
import { JsonLd } from "@/components/ui/json-ld";
import { alternatesFor, localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { getDictionary, getLang } from "@/i18n/server";
import { getAllProductSlugs, getProduct, getProductReviews } from "@/lib/api/server";
import type { ProductDetail, ReviewPage } from "@/lib/api/types";
import { site } from "@/lib/site";

type Props = PageProps<"/[lang]/products/[slug]">;

/** Every product is prerendered; new ones render on their first visit and are cached (ISR). */
export async function generateStaticParams() {
  const products = await getAllProductSlugs();
  return products.length ? products.map((p) => ({ slug: p.slug })) : [{ slug: "oud-kapteet" }];
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const [{ slug }, lang] = await Promise.all([props.params, getLang()]);
  const product = await getProduct(slug);
  if (!product) return {};
  const c = copyOf(product, lang);
  const description = c.short ?? c.description?.slice(0, 160) ?? undefined;
  const images = product.images.map((img) => ({ url: img.url, alt: img.altText ?? c.name }));
  return {
    title: c.name,
    description,
    alternates: alternatesFor(lang, `/products/${slug}`),
    openGraph: {
      type: "website",
      title: c.name,
      description,
      url: localePath(lang, `/products/${slug}`),
      ...(images.length ? { images } : {}),
    },
    twitter: { card: "summary_large_image", title: c.name, description },
  };
}

/** The product's copy in the page language (Arabic fields fall back to English). */
function copyOf(product: ProductDetail, lang: Locale) {
  const en = (ar?: string | null) => (isFallback(lang, ar) ? "en" : undefined);
  return {
    name: product.name,
    nameLang: "en" as const,
    short: localized(lang, product.shortDescription, product.shortDescriptionAr),
    shortLang: en(product.shortDescriptionAr),
    description: localized(lang, product.description, product.descriptionAr),
    descriptionLang: en(product.descriptionAr),
    category: localized(lang, product.category.name, product.category.nameAr),
    categoryLang: en(product.category.nameAr),
  };
}

/** schema.org Product: price, availability, brand and rating for rich results. */
function productJsonLd(product: ProductDetail, reviews: ReviewPage | null, url: string, lang: Locale) {
  const c = copyOf(product, lang);
  const egp = (piasters: number) => (piasters / 100).toFixed(2);
  const inStock = product.variants.length ? product.variants.some((v) => v.stock > 0) : product.stock > 0;
  const availability = `https://schema.org/${inStock ? "InStock" : "OutOfStock"}`;
  const prices = product.variants.length
    ? product.variants.map((v) => v.salePrice ?? v.price)
    : [product.salePrice ?? product.basePrice];
  const rating = reviews?.ratingSummary;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: c.name,
    description: c.description ?? c.short ?? undefined,
    sku: product.sku,
    url,
    image: product.images.map((i) => i.url),
    category: c.category,
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand.name } } : {}),
    offers:
      prices.length > 1
        ? {
            "@type": "AggregateOffer",
            priceCurrency: "EGP",
            lowPrice: egp(Math.min(...prices)),
            highPrice: egp(Math.max(...prices)),
            offerCount: prices.length,
            availability,
          }
        : { "@type": "Offer", priceCurrency: "EGP", price: egp(prices[0]), availability, url },
    ...(rating && rating.totalReviews > 0 && rating.averageRating != null
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: rating.averageRating.toFixed(1),
            reviewCount: rating.totalReviews,
          },
        }
      : {}),
  };
}

function Paragraphs({ text, lang }: { text: string; lang?: string }) {
  return (
    <div lang={lang} dir="auto" className="space-y-4 leading-relaxed text-ink/85 rtl:text-right">
      {text
        .split(/\n{2,}/)
        .filter(Boolean)
        .map((p, i) => (
          <p key={i}>{p}</p>
        ))}
    </div>
  );
}

async function ProductView({ lang, t, params }: { lang: Locale; t: Dictionary; params: Props["params"] }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  const reviews = await getProductReviews(product.id);
  const url = `${site.url}${localePath(lang, `/products/${slug}`)}`;
  const related = product.relatedProducts.slice(0, 4);
  const c = copyOf(product, lang);

  return (
    <>
      <JsonLd data={productJsonLd(product, reviews, url, lang)} />
      <TrackView slug={slug} />
      <Breadcrumbs
        label={t.shop.breadcrumb}
        items={[
          { label: t.common.home, href: localePath(lang) },
          { label: c.category, href: localePath(lang, `/category/${product.category.slug}`), lang: c.categoryLang },
          { label: c.name, lang: c.nameLang },
        ]}
      />

      <div className="mt-6 grid gap-10 lg:mt-10 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-6">
          <Gallery name={c.name} images={product.images} />
        </div>

        <div className="lg:sticky lg:top-32 lg:col-span-6 lg:self-start xl:ps-6">
          <Link
            href={localePath(lang, `/category/${product.category.slug}`)}
            lang={c.categoryLang}
            className="eyebrow text-muted hover:text-ink"
          >
            {c.category}
          </Link>
          <h1 lang={c.nameLang} className="display mt-3 text-[clamp(2.6rem,6vw,5rem)]">
            {c.name}
          </h1>
          {c.short && (
            <p lang={c.shortLang} dir="auto" className="mt-4 max-w-md text-lg leading-snug text-ink/80 rtl:text-right">
              {c.short}
            </p>
          )}

          <div className="mt-8">
            <PurchasePanel product={product} />
          </div>

          <div className="mt-10 border-t border-ink/15 pt-8">
            <h2 className="eyebrow text-muted">{t.productPage.details}</h2>
            {c.description && (
              <div className="mt-4">
                <Paragraphs text={c.description} lang={c.descriptionLang} />
              </div>
            )}
            <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted">{t.productPage.sku}</dt>
              <dd lang="en" className="tabular-nums">
                {product.sku}
              </dd>
              <dt className="text-muted">{t.productPage.category}</dt>
              <dd lang={c.categoryLang}>{c.category}</dd>
            </dl>
          </div>
        </div>
      </div>

      <ReviewSection productId={product.id} initial={reviews} />

      {related.length > 0 && (
        <section aria-labelledby="related-title" className="mt-24 lg:mt-32">
          <h2 id="related-title" className="display text-[clamp(1.8rem,4vw,3rem)]">
            {t.productPage.related}
          </h2>
          <div className="mt-8">
            <ProductGrid products={related} priorityCount={0} />
          </div>
        </section>
      )}

      <RecentlyViewed excludeId={product.id} />
    </>
  );
}

function ProductSkeleton() {
  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-14" aria-hidden>
      <div className="mx-auto aspect-[4/5] w-full max-w-[min(100%,calc(58svh*0.8))] animate-pulse rounded-2xl bg-panel lg:col-span-6 lg:max-w-[min(100%,calc(74svh*0.8))]" />
      <div className="space-y-4 lg:col-span-6">
        <div className="h-4 w-24 animate-pulse rounded bg-panel" />
        <div className="h-16 w-3/4 animate-pulse rounded bg-panel" />
        <div className="h-6 w-1/3 animate-pulse rounded bg-panel" />
        <div className="h-12 w-full animate-pulse rounded-full bg-panel" />
      </div>
    </div>
  );
}

export default async function ProductPage(props: Props) {
  const lang = await getLang();
  const t = await getDictionary(lang);
  return (
    <section className="bg-page px-6 pt-28 pb-28 sm:px-10 sm:pt-36 lg:px-14">
      <div className="mx-auto max-w-[90rem]">
        <Suspense fallback={<ProductSkeleton />}>
          <ProductView lang={lang} t={t} params={props.params} />
        </Suspense>
      </div>
    </section>
  );
}
