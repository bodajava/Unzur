import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Plain JavaScript on purpose: the Hostinger build server has an old glibc, so
// Next falls back to the WASM compiler, which cannot load a TypeScript config.

/**
 * API_ORIGIN (server-only) is where the NestJS API really runs. When it is set,
 * the browser talks to the API through this site at /api/v1 (rewrite below):
 * a different site's cookies are third-party, and Safari (and soon Chrome)
 * drops them, which signed people out and lost their cart on every reload.
 */
const apiOrigin = process.env.API_ORIGIN?.replace(/\/+$/, "");
const api = new URL(apiOrigin ? `${apiOrigin}/api/v1` : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"));

/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheComponents: true,
  // Shares cache invalidations between the site's processes (see cache-handler.cjs),
  // so a dashboard change shows on every copy right away.
  cacheHandlers: { default: require.resolve("./cache-handler.cjs") },
  partialPrefetching: true,
  images: {
    // Product photos come from the backend (local driver) or Vercel Blob.
    remotePatterns: [
      { protocol: api.protocol.replace(":", ""), hostname: api.hostname, port: api.port, pathname: "/uploads/**" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
    formats: ["image/avif", "image/webp"],
    // The optimizer refuses local addresses (SSRF guard). Allow it only when the
    // API itself runs on this machine (development); production keeps the guard.
    dangerouslyAllowLocalIP: ["localhost", "127.0.0.1", "::1"].includes(api.hostname),
  },
  async rewrites() {
    return [
      { source: "/.well-known/mcp/server-card.json", destination: "/api/mcp/server-card" },
      ...(apiOrigin ? [{ source: "/api/v1/:path*", destination: `${apiOrigin}/api/v1/:path*` }] : []),
    ];
  },
  webpack(config, { isServer }) {
    // Hostinger falls back to @next/swc-wasm-nodejs; Webpack scope-hoisting
    // chokes on Next's CJS `image-response.js` export when concatenated into a
    // single metadata route. Disabling it server-side has no client impact.
    if (isServer) {
      config.optimization.concatenateModules = false;
    }
    return config;
  },
  turbopack: {
    // Keep Turbopack inside this project (a pnpm-workspace.yaml in the home folder confused it).
    root: process.cwd(),
  },
};

export default nextConfig;
