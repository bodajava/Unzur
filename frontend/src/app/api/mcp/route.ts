import { getCategories, getProduct, getProducts, getPublicSettings } from "@/lib/api/server";
import { contactInfo } from "@/lib/contact-info";
import { site } from "@/lib/site";
import { MCP_PROTOCOL_VERSION, MCP_SERVER_INFO, MCP_TOOLS } from "@/lib/mcp";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version",
};

const PROTOCOL_VERSION = MCP_PROTOCOL_VERSION;

type RpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

function rpcResult(id: string | number | null, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id, result }, { headers: CORS });
}

function rpcError(id: string | number | null, code: number, message: string, status = 200) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } }, { status, headers: CORS });
}

async function callTool(name: string, args: Record<string, unknown>) {
  if (name === "search_products") {
    const search = typeof args.query === "string" && args.query.trim() ? args.query.trim() : undefined;
    const category = typeof args.category === "string" && args.category.trim() ? args.category.trim() : undefined;
    const limit = typeof args.limit === "number" ? Math.min(20, Math.max(1, Math.round(args.limit))) : 10;
    const data = await getProducts({ search, category, limit });
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
          url: `${site.url}/en/products/${p.slug}`,
        };
      }),
    };
  }

  if (name === "list_categories") {
    const categories = await getCategories();
    return categories.map((c) => ({
      name: c.name,
      nameAr: c.nameAr ?? null,
      slug: c.slug,
      url: `${site.url}/en/category/${c.slug}`,
    }));
  }

  if (name === "get_product") {
    const slug = typeof args.slug === "string" ? args.slug.trim() : "";
    if (!slug) throw new Error("slug is required");
    const product = await getProduct(slug);
    if (!product) return { found: false, slug };
    return {
      found: true,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      category: product.category.name,
      currency: site.currency,
      priceEgp: (product.salePrice ?? product.basePrice) / 100,
      description: product.description ?? product.shortDescription,
      inStock: product.variants.length ? product.variants.some((v) => v.stock > 0) : product.stock > 0,
      variants: product.variants.map((v) => ({
        name: v.name,
        sku: v.sku,
        priceEgp: (v.salePrice ?? v.price) / 100,
        inStock: v.stock > 0,
      })),
      url: `${site.url}/en/products/${product.slug}`,
    };
  }

  if (name === "get_store_info") {
    const settings = await getPublicSettings();
    const c = contactInfo(settings);
    return {
      name: site.name,
      nameAr: site.nameAr,
      description: site.description,
      location: `${site.address.locality}, ${site.address.countryName}`,
      currency: site.currency,
      email: c.email ?? site.email,
      phone: c.phone ?? site.phone,
      instagram: c.instagram ?? site.sameAs[0],
      pages: {
        home: `${site.url}/en`,
        shop: `${site.url}/en/shop`,
        about: `${site.url}/en/about`,
        contact: `${site.url}/en/contact`,
        shipping: `${site.url}/en/legal/shipping`,
        returns: `${site.url}/en/legal/returns`,
        llms: `${site.url}/llms.txt`,
      },
    };
  }

  return null;
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export function GET() {
  return Response.json(
    {
      serverInfo: MCP_SERVER_INFO,
      protocolVersion: PROTOCOL_VERSION,
      transport: "streamable-http",
      serverCard: `${site.url}/.well-known/mcp/server-card.json`,
      capabilities: { tools: { listChanged: false } },
    },
    { headers: CORS },
  );
}

/**
 * Stateless read-only Streamable HTTP MCP endpoint (JSON-RPC 2.0).
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as RpcRequest | null;
  if (!body || typeof body !== "object" || typeof body.method !== "string") {
    return rpcError(null, -32600, "Invalid JSON-RPC request", 400);
  }

  const id = body.id ?? null;

  if (body.method === "notifications/initialized") {
    return new Response(null, { status: 202, headers: CORS });
  }

  if (body.method === "initialize") {
    return rpcResult(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: MCP_SERVER_INFO,
    });
  }

  if (body.method === "ping") {
    return rpcResult(id, {});
  }

  if (body.method === "tools/list") {
    return rpcResult(id, { tools: MCP_TOOLS });
  }

  if (body.method === "tools/call") {
    const toolName = typeof body.params?.name === "string" ? body.params.name : "";
    const toolArgs =
      body.params?.arguments && typeof body.params.arguments === "object"
        ? (body.params.arguments as Record<string, unknown>)
        : {};
    try {
      const output = await callTool(toolName, toolArgs);
      if (output === null) return rpcError(id, -32602, `Unknown tool: ${toolName}`);
      return rpcResult(id, {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      });
    } catch (error) {
      return rpcResult(id, {
        isError: true,
        content: [{ type: "text", text: error instanceof Error ? error.message : "Tool execution failed" }],
      });
    }
  }

  return rpcError(id, -32601, `Method not found: ${body.method}`);
}
