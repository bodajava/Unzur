import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getCategories } from "@/lib/api/server";

/** The storefront: floating glass header, page, footer. */
export default async function StoreLayout({ children }: LayoutProps<"/[lang]">) {
  const categories = await getCategories();
  return (
    <>
      <SiteHeader categories={categories} />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
