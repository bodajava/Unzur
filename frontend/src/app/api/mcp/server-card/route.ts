import { mcpServerCard } from "@/lib/mcp";

/**
 * MCP Server Card (SEP-1649 / SEP-2127), served at `/.well-known/mcp/server-card.json`
 * via rewrite in `next.config.mjs`.
 */
export function GET() {
  return Response.json(mcpServerCard(), {
    headers: {
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
      "access-control-allow-origin": "*",
    },
  });
}
