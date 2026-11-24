// k6 load test: what a crowd of shoppers browsing the store looks like.
// Read-only (pages and catalog API) so it never creates orders, accounts or emails.
//
//   k6 run loadtest/storefront.js                      # gentle ramp to 60 visitors
//   PEAK=150 k6 run loadtest/storefront.js             # push harder
//   SITE=https://unzur.net API=https://unzur.store k6 run loadtest/storefront.js
//
// It stops by itself when more than 10% of requests fail or pages get very slow.
import http from "k6/http";
import { check, group, sleep } from "k6";
import { Trend } from "k6/metrics";

const SITE = __ENV.SITE || "https://unzur.net";
const API = `${__ENV.API || "https://unzur.store"}/api/v1`;
const PEAK = Number(__ENV.PEAK || 60);

const pageTime = new Trend("page_load_ms", true);
const apiTime = new Trend("api_ms", true);

export const options = {
  stages: [
    { duration: "30s", target: Math.round(PEAK / 6) },
    { duration: "1m", target: Math.round(PEAK / 2) },
    { duration: "1m", target: PEAK },
    { duration: "1m", target: PEAK },
    { duration: "20s", target: 0 },
  ],
  thresholds: {
    http_req_failed: [{ threshold: "rate<0.10", abortOnFail: true, delayAbortEval: "20s" }],
    page_load_ms: [{ threshold: "p(95)<8000", abortOnFail: true, delayAbortEval: "30s" }],
    api_ms: ["p(95)<3000"],
  },
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "max"],
};

/** Product slugs, read once before the test starts. */
export function setup() {
  const res = http.get(`${API}/products?limit=20`);
  const slugs = res.json("data.items")?.map((p) => p.slug) ?? [];
  if (!slugs.length) throw new Error("No products returned; is the API up?");
  return { slugs };
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export default function ({ slugs }) {
  const slug = pick(slugs);

  group("browse pages", () => {
    for (const path of ["/en", "/en/shop", `/en/products/${slug}`]) {
      const res = http.get(`${SITE}${path}`, { tags: { name: path.startsWith("/en/products/") ? "/en/products/:slug" : path } });
      pageTime.add(res.timings.duration);
      check(res, { "page 200": (r) => r.status === 200 });
      sleep(1 + Math.random() * 2); // a visitor reads before clicking on
    }
  });

  group("catalog api", () => {
    const calls = [
      ["products", `${API}/products?limit=12`],
      ["product", `${API}/products/${slug}`],
      ["categories", `${API}/categories`],
      ["search", `${API}/products?search=${encodeURIComponent(pick(["lamp", "chair", "شمعه", "fanos"]))}&limit=8`],
      ["settings", `${API}/settings/public`],
    ];
    for (const [name, url] of calls) {
      const res = http.get(url, { tags: { name } });
      apiTime.add(res.timings.duration);
      check(res, { "api 200": (r) => r.status === 200 });
    }
  });

  sleep(1 + Math.random() * 2);
}
