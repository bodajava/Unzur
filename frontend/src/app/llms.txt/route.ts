import { getBestSellers, getCategories, getPublicSettings } from "@/lib/api/server";
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

/**
 * Machine-readable site guide for LLMs and AI agents (https://llmstxt.org/).
 */
export async function GET() {
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
    `# ${site.name} (${site.nameAr})`,
    "",
    `> ${site.description} Based in ${site.address.locality}, ${site.address.countryName}; ships across all 27 Egyptian governorates. All prices are in Egyptian Pounds (${site.currency}).`,
    "",
    `- Website: ${site.url}/en`,
    `- Location: ${site.address.locality}, ${site.address.countryName}`,
    `- Email: ${email}`,
    `- Phone / WhatsApp: ${phone}`,
    `- Instagram: ${instagram}`,
    "",
    "## Main Pages",
    "",
    `- [Home](${site.url}/en): Brand showcase, featured sculptural furniture and lighting pieces with EGP pricing, and collections.`,
    `- [Shop All Pieces](${site.url}/en/shop): Complete catalog with live pricing in ${site.currency}, filters, and stock availability.`,
    `- [About UNZUR](${site.url}/en/about): Brand story, design philosophy, studio details in Cairo, Egypt, and contact information.`,
    `- [Contact Us](${site.url}/en/contact): Direct inquiry form, email, phone, WhatsApp, and Instagram.`,
    `- [Track Your Order](${site.url}/en/track): Check order and delivery status by order number.`,
    "",
  ];

  if (categories.length) {
    lines.push("## Collections", "");
    for (const cat of categories) {
      const label = cat.nameAr ? `${cat.name} (${cat.nameAr})` : cat.name;
      lines.push(`- [${label}](${site.url}/en/category/${cat.slug}): Browse ${cat.name.toLowerCase()} pieces.`);
    }
    lines.push("");
  }

  if (featured.length) {
    lines.push("## Featured Pieces & Pricing", "");
    for (const p of featured) {
      const inStock = p.variants?.length ? p.variants.some((v) => v.stock > 0) : p.stock > 0;
      const summary = p.shortDescription ? ` — ${p.shortDescription}` : "";
      lines.push(
        `- [${p.name}](${site.url}/en/products/${p.slug}): ${priceRangeText(p)} (${inStock ? "In stock" : "Out of stock"}, ${p.category.name})${summary}`,
      );
    }
    lines.push("");
  }

  lines.push(
    "## Store Policies",
    "",
    `- [Shipping & Delivery](${site.url}/en/legal/shipping): Nationwide delivery across Egypt.`,
    `- [Returns & Exchanges](${site.url}/en/legal/returns): 14-day return and exchange policy under Egyptian Consumer Protection Law.`,
    `- [Privacy Policy](${site.url}/en/legal/privacy): How customer data is handled.`,
    `- [Terms & Conditions](${site.url}/en/legal/terms): Storefront terms of use and orders.`,
    "",
    "## Agent & Machine Interfaces",
    "",
    `- [XML Sitemap](${site.url}/sitemap.xml): All public storefront URLs with last-modified dates.`,
    `- [MCP Server Card](${site.url}/.well-known/mcp/server-card.json): SEP-1649 metadata for the read-only UNZUR MCP server.`,
    `- [MCP Endpoint](${site.url}/api/mcp): Streamable HTTP JSON-RPC 2.0 endpoint exposing catalog search, categories, product details, and store info.`,
    `- Markdown Negotiation: Send \`Accept: text/markdown\` to any storefront URL (such as \`${site.url}/en\`) to receive a lightweight Markdown representation.`,
    "",
  );

  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
