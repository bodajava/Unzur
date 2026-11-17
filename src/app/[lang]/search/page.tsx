import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductListing } from "@/components/shop/listing";
import { GridSkeleton } from "@/components/shop/product-grid";
import { SearchHeading } from "@/components/shop/search-heading";
import { getDictionary, getLang } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  // Result pages are endless combinations: keep them out of the index.
  return { title: t.shop.searchTitle, robots: { index: false, follow: true } };
}

export default async function SearchPage(props: PageProps<"/[lang]/search">) {
  const lang = await getLang();
  const t = await getDictionary(lang);
  return (
    <section className="bg-page px-6 pt-32 pb-28 sm:px-10 sm:pt-40 lg:px-14">
      <div className="mx-auto max-w-[90rem]">
        <Suspense fallback={<h1 className="display text-[clamp(2.4rem,7vw,6rem)]">{t.shop.searchTitle}</h1>}>
          <SearchHeading searchParams={props.searchParams} />
        </Suspense>
        <div className="mt-10">
          <Suspense fallback={<GridSkeleton label={t.shop.loading} />}>
            <ProductListing lang={lang} t={t} searchParams={props.searchParams} basePath="/search" search />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
