// Plain JavaScript on purpose: the Hostinger build server has an old glibc, so
// Next falls back to the WASM compiler, which cannot load a TypeScript config.

const api = new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1");

/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheComponents: true,
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
  turbopack: {
    // Keep Turbopack inside this project (a pnpm-workspace.yaml in the home folder confused it).
    root: process.cwd(),
  },
};

export default nextConfig;
