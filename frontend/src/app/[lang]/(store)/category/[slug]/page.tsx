import { isFallback, localized } from "@/i18n/format";
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
  const name = localized(lang, category.name, category.nameAr);
  const ar = category.nameAr ? ` (${category.nameAr})` : "";
  return {
    title: `${name}${ar} in Egypt`,
    description:
      localized(lang, category.description, category.descriptionAr) ??
      `${name}${ar} by UNZUR (أنظر), designed and made in Egypt. ${t.meta.description}`,
    keywords: [name, ...(category.nameAr ? [category.nameAr, `${category.nameAr} مصر`] : []), `${name} Egypt`, `UNZUR ${name}`, "أنظر"],
    alternates: alternatesFor(lang, `/category/${slug}`),
    openGraph: { title: name, url: localePath(lang, `/category/${slug}`) },
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
  const name = localized(lang, category.name, category.nameAr);
  const nameLang = isFallback(lang, category.nameAr) ? "en" : undefined;
  const description = localized(lang, category.description, category.descriptionAr);
  return (
    <>
      <Breadcrumbs
        label={t.shop.breadcrumb}
        items={[
          { label: t.common.home, href: localePath(lang) },
          { label: t.shop.title, href: localePath(lang, "/shop") },
          { label: name, lang: nameLang },
        ]}
      />
      <h1 lang={nameLang} className="display mt-6 text-[clamp(3rem,9vw,8rem)]">
        {name}
      </h1>
      {description && (
        <p lang={isFallback(lang, category.descriptionAr) ? "en" : undefined} dir="auto" className="mt-4 mb-10 max-w-md text-muted rtl:text-right">
          {description}
        </p>
      )}
      <div className={description ? "" : "mt-10"}>
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
