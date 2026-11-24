import { legal, LEGAL_SLUGS, type LegalSlug } from "@/content/legal";
import { getBestSellers, getCategories, getCategory, getProduct, getProducts, getPublicSettings } from "@/lib/api/server";
import type { ProductCard } from "@/lib/api/types";
import { contactInfo } from "@/lib/contact-info";
import { site } from "@/lib/site";

function formatEgp(piasters: number): string {
  return `${(piasters / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${site.currency}`;
}

function priceRangeText(product: ProductCard): string {
  const prices = product.variants?.length
    ? product.variants.map((v) => v.salePrice ?? v.price)
    : [product.salePrice ?? product.basePrice];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatEgp(min) : `${formatEgp(min)} – ${formatEgp(max)}`;
}

function stockText(product: ProductCard): string {
  const inStock = product.variants?.length ? product.variants.some((v) => v.stock > 0) : product.stock > 0;
  return inStock ? "In stock" : "Out of stock";
}

function markdownResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      vary: "Accept",
      "cache-control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}

function stripLocale(pathname: string): string {
  const clean = pathname.replace(/\/+$/, "") || "/";
  if (clean === "/en" || clean === "/ar") return "/";
  if (clean.startsWith("/en/")) return clean.slice(3);
  if (clean.startsWith("/ar/")) return clean.slice(3);
  return clean;
}

/**
 * Lightweight Markdown representations of public storefront pages, served when
 * an AI agent requests `Accept: text/markdown` (rewritten from `proxy.ts`).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawPath = searchParams.get("path") ?? "/";
  const route = stripLocale(rawPath);

  if (route === "/") {
    const [categories, featured, settings] = await Promise.all([
      getCategories(),
      getBestSellers(12),
      getPublicSettings(),
    ]);
    const c = contactInfo(settings);
    const email = c.email ?? site.email;
    const phone = c.phone ?? site.phone;
    const instagram = c.instagram ?? site.sameAs[0];

    const lines: string[] = [
      `# ${site.title}`,
      "",
      site.description,
      "",
      `- **Brand:** ${site.name} (${site.nameAr})`,
      `- **Location:** ${site.address.locality}, ${site.address.countryName}`,
      `- **Currency:** ${site.currency}`,
      `- **Email:** ${email}`,
      `- **Phone / WhatsApp:** ${phone}`,
      `- **Instagram:** ${instagram}`,
      "",
      "## Featured Pieces",
      "",
    ];

    if (featured.length) {
      for (const p of featured) {
        const desc = p.shortDescription ? ` — ${p.shortDescription}` : "";
        lines.push(`- [${p.name}](${site.url}/en/products/${p.slug}) — **${priceRangeText(p)}** (${stockText(p)}, ${p.category.name})${desc}`);
      }
    } else {
      lines.push(`Browse all pieces at [${site.url}/en/shop](${site.url}/en/shop).`);
    }

    if (categories.length) {
      lines.push("", "## Collections", "");
      for (const cat of categories) {
        const ar = cat.nameAr ? ` (${cat.nameAr})` : "";
        lines.push(`- [${cat.name}${ar}](${site.url}/en/category/${cat.slug})`);
      }
    }

    lines.push(
      "",
      "## Navigation",
      "",
      `- [Shop All Pieces](${site.url}/en/shop)`,
      `- [About UNZUR](${site.url}/en/about)`,
      `- [Contact Us](${site.url}/en/contact)`,
      `- [Shipping & Delivery](${site.url}/en/legal/shipping)`,
      `- [Returns & Exchanges](${site.url}/en/legal/returns)`,
      `- [Privacy Policy](${site.url}/en/legal/privacy)`,
      `- [Terms & Conditions](${site.url}/en/legal/terms)`,
      `- [llms.txt](${site.url}/llms.txt)`,
      "",
    );

    return markdownResponse(lines.join("\n"));
  }

  if (route === "/shop") {
    const [catalog, categories] = await Promise.all([getProducts({ limit: 50, sort: "-createdAt" }), getCategories()]);
    const lines: string[] = [
      `# Shop All Pieces — ${site.name}`,
      "",
      `All prices are in Egyptian Pounds (${site.currency}).`,
      "",
    ];
    if (categories.length) {
      lines.push("## Collections", "");
      for (const cat of categories) lines.push(`- [${cat.name}](${site.url}/en/category/${cat.slug})`);
      lines.push("");
    }
    lines.push(`## Pieces (${catalog.meta.total})`, "");
    for (const p of catalog.items) {
      lines.push(`- [${p.name}](${site.url}/en/products/${p.slug}) — **${priceRangeText(p)}** (${stockText(p)}, ${p.category.name})`);
    }
    lines.push("");
    return markdownResponse(lines.join("\n"));
  }

  if (route === "/about") {
    const [categories, settings] = await Promise.all([getCategories(), getPublicSettings()]);
    const c = contactInfo(settings);
    const lines: string[] = [
      `# About ${site.name} (${site.nameAr})`,
      "",
      site.description,
      "",
      site.descriptionAr,
      "",
      "## Studio Details",
      "",
      `- **Location:** ${site.address.locality}, ${site.address.countryName}`,
      `- **Shipping:** All 27 Egyptian governorates`,
      `- **Currency:** ${site.currency}`,
      `- **Email:** ${c.email ?? site.email}`,
      `- **Phone / WhatsApp:** ${c.phone ?? site.phone}`,
      `- **Instagram:** ${c.instagram ?? site.sameAs[0]}`,
      "",
    ];
    if (categories.length) {
      lines.push("## Collections", "");
      for (const cat of categories) lines.push(`- [${cat.name}](${site.url}/en/category/${cat.slug})`);
      lines.push("");
    }
    return markdownResponse(lines.join("\n"));
  }

  if (route === "/contact") {
    const settings = await getPublicSettings();
    const c = contactInfo(settings);
    const lines = [
      `# Contact ${site.name}`,
      "",
      `- **Email:** ${c.email ?? site.email}`,
      `- **Phone / WhatsApp:** ${c.phone ?? site.phone}`,
      `- **Instagram:** ${c.instagram ?? site.sameAs[0]}`,
      `- **Location:** ${site.address.locality}, ${site.address.countryName}`,
      `- **Contact Form:** ${site.url}/en/contact`,
      "",
    ];
    return markdownResponse(lines.join("\n"));
  }

  if (route.startsWith("/category/")) {
    const slug = decodeURIComponent(route.slice("/category/".length));
    const [category, catalog] = await Promise.all([getCategory(slug), getProducts({ category: slug, limit: 50 })]);
    if (!category) return markdownResponse("# 404 Not Found\n\nCategory not found.\n", 404);
    const lines = [
      `# ${category.name} — ${site.name}`,
      "",
      ...(category.description ? [category.description, ""] : []),
      `## Pieces (${catalog.meta.total})`,
      "",
      ...catalog.items.map(
        (p) => `- [${p.name}](${site.url}/en/products/${p.slug}) — **${priceRangeText(p)}** (${stockText(p)})`,
      ),
      "",
    ];
    return markdownResponse(lines.join("\n"));
  }

  if (route.startsWith("/products/")) {
    const slug = decodeURIComponent(route.slice("/products/".length));
    const product = await getProduct(slug);
    if (!product) return markdownResponse("# 404 Not Found\n\nProduct not found.\n", 404);
    const inStock = product.variants.length ? product.variants.some((v) => v.stock > 0) : product.stock > 0;
    const lines: string[] = [
      `# ${product.name}`,
      "",
      `- **URL:** ${site.url}/en/products/${product.slug}`,
      `- **Category:** [${product.category.name}](${site.url}/en/category/${product.category.slug})`,
      `- **SKU:** ${product.sku}`,
      `- **Availability:** ${inStock ? "In stock" : "Out of stock"}`,
    ];
    if (product.variants.length) {
      lines.push("", "## Versions & Pricing", "");
      for (const v of product.variants) {
        const price = formatEgp(v.salePrice ?? v.price);
        lines.push(`- **${v.name}** (${v.sku}): ${price} — ${v.stock > 0 ? "In stock" : "Out of stock"}`);
      }
    } else {
      lines.push(`- **Price:** ${formatEgp(product.salePrice ?? product.basePrice)}`);
    }
    const desc = product.description ?? product.shortDescription ?? product.descriptionAr ?? product.shortDescriptionAr;
    if (desc) lines.push("", "## Description", "", desc);
    lines.push("");
    return markdownResponse(lines.join("\n"));
  }

  if (route.startsWith("/legal/")) {
    const slug = route.slice("/legal/".length) as LegalSlug;
    if (!LEGAL_SLUGS.includes(slug)) return markdownResponse("# 404 Not Found\n", 404);
    const doc = legal.en[slug];
    const lines: string[] = [`# ${doc.title} — ${site.name}`, "", doc.summary, ""];
    for (const sec of doc.sections) {
      lines.push(`## ${sec.heading}`, "");
      for (const p of sec.body) lines.push(p, "");
      if (sec.list) {
        for (const item of sec.list) lines.push(`- ${item}`);
        lines.push("");
      }
    }
    return markdownResponse(lines.join("\n"));
  }

  return markdownResponse(
    `# ${site.name}\n\nSee [${site.url}/llms.txt](${site.url}/llms.txt) or [${site.url}/en](${site.url}/en).\n`,
    404,
  );
}
