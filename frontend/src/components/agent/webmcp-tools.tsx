"use client";

import { useEffect } from "react";
import { apiUrl, site } from "@/lib/site";

type ModelContextTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean };
  execute: (args: Record<string, unknown>) => Promise<unknown>;
};

type ModelContext = {
  registerTool?: (tool: ModelContextTool) => void;
  unregisterTool?: (name: string) => void;
};

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${apiUrl}${path}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`API ${path} failed (${res.status})`);
  const json = (await res.json()) as { data: T };
  return json.data;
}

/**
 * Exposes read-only WebMCP tools to in-browser AI agents when the browser
 * supports `navigator.modelContext.registerTool()`. No-op on standard browsers.
 */
export function WebMcpTools() {
  useEffect(() => {
    const mc = (navigator as Navigator & { modelContext?: ModelContext }).modelContext;
    if (!mc || typeof mc.registerTool !== "function") return;

    const tools: ModelContextTool[] = [
      {
        name: "search_products",
        description: "Search UNZUR's furniture, decor, and lighting catalog with EGP pricing and stock status.",
        annotations: { readOnlyHint: true },
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search keywords (English or Arabic), e.g. chair, table, lamp" },
            category: { type: "string", description: "Optional category slug" },
            limit: { type: "number", description: "Max items to return (1-20, default 10)" },
          },
        },
        execute: async (args) => {
          const params = new URLSearchParams();
          if (typeof args.query === "string" && args.query.trim()) params.set("search", args.query.trim());
          if (typeof args.category === "string" && args.category.trim()) params.set("category", args.category.trim());
          const limit = typeof args.limit === "number" ? Math.min(20, Math.max(1, Math.round(args.limit))) : 10;
          params.set("limit", String(limit));
          const data = await fetchApi<{
            items: Array<{
              name: string;
              slug: string;
              basePrice: number;
              salePrice: number | null;
              stock: number;
              category: { name: string; slug: string };
              variants?: Array<{ price: number; salePrice: number | null; stock: number }>;
            }>;
            meta: { total: number };
          }>(`/products?${params.toString()}`);
          return {
            currency: site.currency,
            total: data.meta.total,
            products: data.items.map((p) => {
              const prices = p.variants?.length
                ? p.variants.map((v) => v.salePrice ?? v.price)
                : [p.salePrice ?? p.basePrice];
              const inStock = p.variants?.length ? p.variants.some((v) => v.stock > 0) : p.stock > 0;
              return {
                name: p.name,
                slug: p.slug,
                category: p.category.name,
                priceEgp: Math.min(...prices) / 100,
                inStock,
                url: `${window.location.origin}/en/products/${p.slug}`,
              };
            }),
          };
        },
      },
      {
        name: "list_categories",
        description: "List all UNZUR product collections and categories.",
        annotations: { readOnlyHint: true },
        inputSchema: { type: "object", properties: {} },
        execute: async () => {
          const categories = await fetchApi<Array<{ name: string; nameAr?: string | null; slug: string }>>("/categories");
          return categories.map((c) => ({
            name: c.name,
            nameAr: c.nameAr ?? null,
            slug: c.slug,
            url: `${window.location.origin}/en/category/${c.slug}`,
          }));
        },
      },
      {
        name: "get_product",
        description: "Get full details, variants, stock availability, and EGP pricing for a UNZUR product by slug.",
        annotations: { readOnlyHint: true },
        inputSchema: {
          type: "object",
          properties: {
            slug: { type: "string", description: "Product URL slug" },
          },
          required: ["slug"],
        },
        execute: async (args) => {
          const slug = typeof args.slug === "string" ? args.slug.trim() : "";
          if (!slug) throw new Error("slug is required");
          const p = await fetchApi<{
            name: string;
            slug: string;
            sku: string;
            description: string | null;
            shortDescription: string | null;
            basePrice: number;
            salePrice: number | null;
            stock: number;
            category: { name: string; slug: string };
            variants: Array<{ name: string; sku: string; price: number; salePrice: number | null; stock: number }>;
          }>(`/products/${encodeURIComponent(slug)}`);
          return {
            name: p.name,
            slug: p.slug,
            sku: p.sku,
            category: p.category.name,
            currency: site.currency,
            priceEgp: (p.salePrice ?? p.basePrice) / 100,
            description: p.description ?? p.shortDescription,
            inStock: p.variants.length ? p.variants.some((v) => v.stock > 0) : p.stock > 0,
            variants: p.variants.map((v) => ({
              name: v.name,
              sku: v.sku,
              priceEgp: (v.salePrice ?? v.price) / 100,
              inStock: v.stock > 0,
            })),
            url: `${window.location.origin}/en/products/${p.slug}`,
          };
        },
      },
      {
        name: "get_store_info",
        description: "Get UNZUR brand summary, Cairo/Egypt studio location, contact details, currency, and policy links.",
        annotations: { readOnlyHint: true },
        inputSchema: { type: "object", properties: {} },
        execute: async () => {
          const settings = await fetchApi<Record<string, unknown>>("/settings/public").catch(
            (): Record<string, unknown> => ({}),
          );
          return {
            name: site.name,
            nameAr: site.nameAr,
            description: site.description,
            location: `${site.address.locality}, ${site.address.countryName}`,
            currency: site.currency,
            email: typeof settings.contact_email === "string" && settings.contact_email ? settings.contact_email : site.email,
            phone: typeof settings.whatsapp_number === "string" && settings.whatsapp_number ? settings.whatsapp_number : site.phone,
            instagram: typeof settings.instagram_url === "string" && settings.instagram_url ? settings.instagram_url : site.sameAs[0],
            pages: {
              home: `${window.location.origin}/en`,
              shop: `${window.location.origin}/en/shop`,
              about: `${window.location.origin}/en/about`,
              contact: `${window.location.origin}/en/contact`,
              shipping: `${window.location.origin}/en/legal/shipping`,
              returns: `${window.location.origin}/en/legal/returns`,
            },
          };
        },
      },
    ];

    const registered: string[] = [];
    for (const tool of tools) {
      try {
        mc.registerTool(tool);
        registered.push(tool.name);
      } catch {
        // Ignore experimental browser API rejections.
      }
    }

    return () => {
      for (const name of registered) {
        try {
          mc.unregisterTool?.(name);
        } catch {
          // Ignore cleanup errors.
        }
      }
    };
  }, []);

  return null;
}
