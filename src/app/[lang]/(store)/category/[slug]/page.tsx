import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { ProductListing } from "@/components/shop/listing";
import { GridSkeleton } from "@/components/shop/product-grid";
import { alternatesFor, localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { getDictionary, getLang } from "@/i18n/server";
import { getCategories, getCategory } from "@/lib/api/server";

/** Every category is prerendered; new ones are rendered on first visit and cached. */
export async function generateStaticParams() {
  const categories = await getCategories();
  const slugs = categories.flatMap((c) => [c.slug, ...c.children.map((child) => child.slug)]);
  return slugs.length ? slugs.map((slug) => ({ slug })) : [{ slug: "furniture" }];
}

export async function generateMetadata(props: PageProps<"/[lang]/category/[slug]">): Promise<Metadata> {
  const [{ slug }, lang] = await Promise.all([props.params, getLang()]);
  const category = await getCategory(slug);
  if (!category) return {};
  const t = await getDictionary(lang);
  return {
    title: category.name,
    description: category.description ?? `${category.name} · ${t.meta.description}`,
    alternates: alternatesFor(lang, `/category/${slug}`),
    openGraph: { title: category.name, url: localePath(lang, `/category/${slug}`) },
  };
}

async function CategoryView({
  lang,
  t,
  params,
  searchParams,
}: {
  lang: Locale;
  t: Dictionary;
  params: PageProps<"/[lang]/category/[slug]">["params"];
  searchParams: PageProps<"/[lang]/category/[slug]">["searchParams"];
}) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) notFound();
  return (
    <>
      <Breadcrumbs
        label={t.shop.breadcrumb}
        items={[
          { label: t.common.home, href: localePath(lang) },
          { label: t.shop.title, href: localePath(lang, "/shop") },
          { label: category.name, lang: "en" },
        ]}
      />
      <h1 lang="en" className="display mt-6 text-[clamp(3rem,9vw,8rem)]">
        {category.name}
      </h1>
      {category.description && (
        <p lang="en" dir="auto" className="mt-4 mb-10 max-w-md text-muted rtl:text-right">
          {category.description}
        </p>
      )}
      <div className={category.description ? "" : "mt-10"}>
        <Suspense fallback={<GridSkeleton label={t.shop.loading} />}>
          <ProductListing
            lang={lang}
            t={t}
            searchParams={searchParams}
            basePath={`/category/${slug}`}
            category={slug}
          />
        </Suspense>
      </div>
    </>
  );
}

export default async function CategoryPage(props: PageProps<"/[lang]/category/[slug]">) {
  const lang = await getLang();
  const t = await getDictionary(lang);
  return (
    <section className="bg-page px-6 pt-32 pb-28 sm:px-10 sm:pt-40 lg:px-14">
      <div className="mx-auto max-w-[90rem]">
        <Suspense fallback={<GridSkeleton label={t.shop.loading} />}>
          <CategoryView lang={lang} t={t} params={props.params} searchParams={props.searchParams} />
        </Suspense>
      </div>
    </section>
  );
}
