import { revalidateTag } from "next/cache";
import { apiUrl } from "@/lib/site";

const ALLOWED = /^(products|categories|brands|settings|reviews|product:[a-z0-9-]{1,120}|reviews:[0-9a-f-]{36})$/;
const STAFF = new Set(["STAFF", "ADMIN", "SUPER_ADMIN"]);

/**
 * POST { tags: string[] } from the dashboard after a change. The bearer
 * token is checked against the API (must be staff) before any cache is
 * dropped. Stale pages are served while fresh ones render ("max").
 */
export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return Response.json({ ok: false }, { status: 401 });

  const me = await fetch(`${apiUrl}/auth/me`, { headers: { authorization: auth, accept: "application/json" } });
  const body = (await me.json().catch(() => null)) as { data?: { role?: string } } | null;
  if (!me.ok || !body?.data?.role || !STAFF.has(body.data.role)) {
    return Response.json({ ok: false }, { status: 403 });
  }

  const input = (await request.json().catch(() => null)) as { tags?: unknown } | null;
  const tags = Array.isArray(input?.tags) ? input.tags.filter((t): t is string => typeof t === "string" && ALLOWED.test(t)) : [];
  for (const tag of tags.slice(0, 20)) revalidateTag(tag, "max");
  return Response.json({ ok: true, revalidated: tags });
}
