"use client";

import { apiUrl } from "@/lib/site";
import type { ApiEnvelope } from "./types";

const GUEST_KEY = "unzur_guest_id";

/** The guest id the API gave us (also kept by the API as a cookie). */
export function rememberGuestId(guestId: string | null | undefined) {
  if (!guestId) return;
  try {
    localStorage.setItem(GUEST_KEY, guestId);
  } catch {
    /* private mode: the cookie still works */
  }
}

function guestHeader(): Record<string, string> {
  try {
    const id = localStorage.getItem(GUEST_KEY);
    return id ? { "x-guest-id": id } : {};
  } catch {
    return {};
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errors?: unknown,
  ) {
    super(message);
  }
}

/** Browser calls to the API: sends cookies + guest id, unwraps { success, data }. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${apiUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: { accept: "application/json", "content-type": "application/json", ...guestHeader(), ...init.headers },
  });
  const body = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!res.ok || !body?.success) {
    throw new ApiError(body?.message ?? "Something went wrong. Try again.", res.status, body?.errors);
  }
  return body.data;
}
