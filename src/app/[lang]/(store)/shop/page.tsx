import type { Metadata } from "next";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { ProductListing } from "@/components/shop/listing";
import { GridSkeleton } from "@/components/shop/product-grid";
import { alternatesFor, localePath } from "@/i18n/config";
import { getDictionary, getLang } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  const t = await getDictionary(lang);
  return {
    title: t.shop.title,
    description: `${t.shop.intro} ${t.meta.description}`,
    alternates: alternatesFor(lang, "/shop"),
    openGraph: { title: t.shop.title, url: localePath(lang, "/shop") },
  };
}

export default async function ShopPage(props: PageProps<"/[lang]/shop">) {
  const lang = await getLang();
  const t = await getDictionary(lang);
  return (
    <section className="bg-page px-6 pt-32 pb-28 sm:px-10 sm:pt-40 lg:px-14">
      <div className="mx-auto max-w-[90rem]">
        <Breadcrumbs
          label={t.shop.breadcrumb}
          items={[{ label: t.common.home, href: localePath(lang) }, { label: t.shop.title }]}
        />
        <h1 className="display mt-6 text-[clamp(3rem,9vw,8rem)]">{t.shop.title}</h1>
        <p className="mt-4 mb-10 max-w-md text-muted">{t.shop.intro}</p>
        <Suspense fallback={<GridSkeleton label={t.shop.loading} />}>
          <ProductListing lang={lang} t={t} searchParams={props.searchParams} basePath="/shop" />
        </Suspense>
      </div>
    </section>
  );
}
