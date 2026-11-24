// "use cache" handler shared by every copy of the site.
//
// Hostinger runs more than one Next.js process. Each keeps its own in-memory
// cache, so a dashboard change (revalidateTag) used to refresh only the process
// that received it; the others served the old page until their timer ran out.
//
// Entries stay in each process's memory (Next's built-in LRU handler). Only
// the tag invalidations are shared, through Redis (Upstash REST):
//   updateTags  -> write the tag's stale/expired times to the hash `next:tags`
//   refreshTags -> read that hash (at most once a second) into Next's shared
//                  tags manifest, which both "use cache" and page caches check.
// Without UPSTASH_* env vars it behaves exactly like the built-in handler.
const https = require("node:https");
const { createDefaultCacheHandler } = require("next/dist/server/lib/cache-handlers/default");
const { tagsManifest } = require("next/dist/server/lib/incremental-cache/tags-manifest.external");

const base = createDefaultCacheHandler(50 * 1024 * 1024);
// Off during `next build`: there is one builder, nothing to coordinate.
const ENABLED = process.env.NEXT_PHASE !== "phase-production-build";
const REDIS_URL = ENABLED ? process.env.UPSTASH_REDIS_REST_URL : undefined;
const REDIS_TOKEN = ENABLED ? process.env.UPSTASH_REDIS_REST_TOKEN : undefined;
const HASH = "next:tags";
const SYNC_EVERY_MS = 1000;

let lastSync = 0;
let syncing = Promise.resolve();

/**
 * One Upstash REST command. Plain node:https on purpose: Next.js instruments
 * the global fetch while rendering, and a fetch from inside the cache handler
 * would be mixed into the page render.
 */
function redis(command) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(command);
    const req = https.request(
      REDIS_URL,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "content-type": "application/json", "content-length": Buffer.byteLength(body) },
        timeout: 1500,
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) return reject(new Error(`redis ${res.statusCode}`));
          try {
            resolve(JSON.parse(data).result);
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("redis timeout")));
    req.on("error", reject);
    req.end(body);
  });
}

/** Keeps the newest stale/expired time per tag (another process may be ahead). */
function merge(tag, remote) {
  const local = tagsManifest.get(tag) || {};
  const merged = { ...local };
  for (const field of ["stale", "expired"]) {
    if (typeof remote[field] === "number" && remote[field] > (local[field] ?? 0)) merged[field] = remote[field];
  }
  tagsManifest.set(tag, merged);
}

module.exports = {
  get: (cacheKey, softTags) => base.get(cacheKey, softTags),
  set: (cacheKey, pendingEntry) => base.set(cacheKey, pendingEntry),
  getExpiration: (tags) => base.getExpiration(tags),

  async refreshTags() {
    if (!REDIS_URL || !REDIS_TOKEN) return;
    const now = Date.now();
    if (now - lastSync < SYNC_EVERY_MS) return syncing;
    lastSync = now;
    syncing = (async () => {
      try {
        const flat = (await redis(["HGETALL", HASH])) || [];
        for (let i = 0; i < flat.length; i += 2) {
          try {
            merge(flat[i], JSON.parse(flat[i + 1]));
          } catch {
            /* skip a malformed value */
          }
        }
      } catch {
        /* Redis unreachable: keep serving with what this process knows */
      }
    })();
    return syncing;
  },

  async updateTags(tags, durations) {
    await base.updateTags(tags, durations);
    if (!REDIS_URL || !REDIS_TOKEN || !tags.length) return;
    try {
      const args = ["HSET", HASH];
      for (const tag of tags) args.push(tag, JSON.stringify(tagsManifest.get(tag) || {}));
      await redis(args);
    } catch {
      /* the other processes will still refresh when their cache times out */
    }
  },
};
