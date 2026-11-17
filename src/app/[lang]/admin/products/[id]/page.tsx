import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductEditPage } from "@/components/admin/product-edit-page";
import { getDictionary } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.admin.products.title };
}

export default function AdminProductPage(props: PageProps<"/[lang]/admin/products/[id]">) {
  return (
    <Suspense>
      <ProductEditPage params={props.params} />
    </Suspense>
  );
}
