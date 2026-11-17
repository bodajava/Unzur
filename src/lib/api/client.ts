"use client";

import { apiUrl } from "@/lib/site";
import { getAccessToken, getGuestId, hasSessionFlag, refreshSession } from "./session";
import type { ApiEnvelope } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errors?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** 0 = the request never reached the API (offline, DNS, CORS). */
  get isNetwork() {
    return this.status === 0;
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

/** { page: 2, search: "oud", inStock: undefined } -> "?page=2&search=oud" */
export function qs(query?: Query): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const out = params.toString();
  return out ? `?${out}` : "";
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  /** JSON body (serialized for you). */
  json?: unknown;
  /** Skip the Authorization header (public auth endpoints). */
  anonymous?: boolean;
}

async function send(path: string, opts: RequestOptions, token: string | null): Promise<Response> {
  const { json, headers, ...rest } = opts;
  const init: RequestInit = { ...rest };
  delete (init as RequestOptions).anonymous;
  const guestId = getGuestId();
  const lang = typeof document === "undefined" ? undefined : document.documentElement.lang;
  return fetch(`${apiUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      accept: "application/json",
      ...(json !== undefined ? { "content-type": "application/json" } : {}),
      ...(guestId ? { "x-guest-id": guestId } : {}),
      ...(lang ? { "accept-language": lang } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });
}

/**
 * Browser call to the API. Sends the guest id, the bearer token (refreshing
 * it when it is about to expire, and once more after a 401), and unwraps the
 * { success, data, message } envelope. Throws ApiError with the API's message.
 */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let token = opts.anonymous ? null : await getAccessToken();
  let res: Response;
  try {
    res = await send(path, opts, token);
    if (res.status === 401 && !opts.anonymous && (token || hasSessionFlag())) {
      token = await refreshSession();
      if (token) res = await send(path, opts, token);
    }
  } catch {
    throw new ApiError("Network error", 0);
  }
  const body = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!res.ok || !body?.success) {
    throw new ApiError(body?.message ?? `Request failed (${res.status})`, res.status, body?.errors);
  }
  return body.data;
}

/** Binary downloads (invoice PDF). Same auth rules as api(). */
export async function apiBlob(path: string): Promise<Blob> {
  const token = await getAccessToken();
  let res: Response;
  try {
    res = await send(path, { method: "GET", headers: { accept: "application/pdf" } }, token);
  } catch {
    throw new ApiError("Network error", 0);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiEnvelope<unknown> | null;
    throw new ApiError(body?.message ?? `Request failed (${res.status})`, res.status);
  }
  return res.blob();
}
