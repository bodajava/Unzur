import type { Metadata } from "next";
import { ProductForm } from "@/components/admin/product-form";
import { getDictionary } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.admin.product.newTitle };
}

export default function NewProductPage() {
  return <ProductForm />;
}
