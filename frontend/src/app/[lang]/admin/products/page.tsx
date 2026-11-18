import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductsList } from "@/components/admin/products-list";
import { getDictionary } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.admin.products.title };
}

export default function AdminProductsPage() {
  return (
    <Suspense>
      <ProductsList />
    </Suspense>
  );
}
