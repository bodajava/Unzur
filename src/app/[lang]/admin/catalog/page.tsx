import type { Metadata } from "next";
import { PageTitle } from "@/components/admin/ui";
import { TaxonomyManager } from "@/components/admin/taxonomy-manager";
import { getDictionary } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.admin.catalog.title };
}

export default async function CatalogPage() {
  const t = await getDictionary();
  return (
    <div>
      <PageTitle>{t.admin.catalog.title}</PageTitle>
      <div className="grid gap-6 xl:grid-cols-2">
        <TaxonomyManager kind="categories" />
        <TaxonomyManager kind="brands" />
      </div>
    </div>
  );
}
