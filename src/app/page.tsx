import { Collections } from "@/components/home/collections";
import { Concept } from "@/components/home/concept";
import { Hero } from "@/components/home/hero";
import { Pieces } from "@/components/home/pieces";
import { JsonLd } from "@/components/ui/json-ld";
import { getBestSellers, getCategories } from "@/lib/api/server";
import { site } from "@/lib/site";

export default async function HomePage() {
  const [products, categories] = await Promise.all([getBestSellers(8), getCategories()]);
  const words = categories.length ? [...categories.map((c) => c.name), "Best sellers"] : [];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "UNZUR best sellers",
          itemListElement: products.map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${site.url}/products/${p.slug}`,
            name: p.name,
          })),
        }}
      />
      <Hero words={words} />
      <Concept />
      <Pieces products={products} />
      <Collections categories={categories} />
    </>
  );
}
