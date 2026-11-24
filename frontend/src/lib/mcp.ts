import { site } from "@/lib/site";

export const MCP_PROTOCOL_VERSION = "2025-06-18";

export const MCP_SERVER_INFO = {
  name: "unzur-storefront",
  title: "UNZUR Storefront MCP",
  version: "1.0.0",
} as const;

export const MCP_TOOLS = [
  {
    name: "search_products",
    description: "Search UNZUR's sculptural furniture, decor, and lighting catalog with EGP pricing and availability.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search keywords (English or Arabic)" },
        category: { type: "string", description: "Optional category slug" },
        limit: { type: "number", description: "Max items to return (1-20, default 10)" },
      },
    },
  },
  {
    name: "list_categories",
    description: "List all UNZUR product collections and categories.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_product",
    description: "Fetch full details, variants, stock status, and EGP pricing for a single UNZUR product by slug.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Product URL slug" },
      },
      required: ["slug"],
    },
  },
  {
    name: "get_store_info",
    description: "Get UNZUR brand summary, Cairo/Egypt studio address, phone, email, Instagram, currency, and policy links.",
    inputSchema: { type: "object", properties: {} },
  },
] as const;

export function mcpServerCard() {
  const endpoint = `${site.url}/api/mcp`;
  return {
    $schema: "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
    name: "net.unzur/storefront",
    version: MCP_SERVER_INFO.version,
    title: MCP_SERVER_INFO.title,
    description:
      "Read-only Model Context Protocol server for exploring UNZUR's furniture, decor, and lighting catalog, EGP pricing, collections, and store details.",
    websiteUrl: site.url,
    icons: [{ src: `${site.url}/icon-192.png`, sizes: "192x192", mimeType: "image/png" }],
    serverInfo: MCP_SERVER_INFO,
    transport: {
      type: "streamable-http",
      endpoint,
    },
    remotes: [
      {
        type: "streamable-http",
        url: endpoint,
      },
    ],
    capabilities: {
      tools: {
        listChanged: false,
      },
    },
    tools: MCP_TOOLS,
  };
}
