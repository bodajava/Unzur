"use client";

import { apiUrl } from "@/lib/site";
import type { ApiEnvelope, AuthTokens } from "./types";

/*
 * Auth session in the browser.
 *  - The access token lives only in memory (never in localStorage).
 *  - The refresh token is an httpOnly cookie set by the API (path /api/v1/auth),
 *    so a page reload gets a fresh access token from POST /auth/refresh.
 *  - A small "signed in" flag in localStorage tells us whether that refresh is
 *    worth trying, so anonymous visitors don't hit /auth/refresh on every load.
 */

const FLAG_KEY = "unzur_signed_in";
const GUEST_KEY = "unzur_guest_id";
/** Refresh this long before the access token actually expires. */
const SKEW_MS = 30_000;

let accessToken: string | null = null;
let expiresAt = 0;
let refreshing: Promise<string | null> | null = null;
const listeners = new Set<(signedIn: boolean) => void>();

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function hasSessionFlag(): boolean {
  return storage()?.getItem(FLAG_KEY) === "1";
}

function notify(signedIn: boolean) {
  listeners.forEach((l) => l(signedIn));
}

/** Called with true/false whenever the visitor signs in or out (other tabs included). */
export function onSessionChange(listener: (signedIn: boolean) => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === FLAG_KEY) {
      if (e.newValue !== "1") {
        accessToken = null;
        expiresAt = 0;
      }
      listener(e.newValue === "1");
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Store tokens from login / verify-otp / refresh / change-password. */
export function setSession(tokens: Pick<AuthTokens, "accessToken" | "accessTokenExpiresAt">) {
  accessToken = tokens.accessToken;
  expiresAt = new Date(tokens.accessTokenExpiresAt).getTime();
  const wasSignedIn = hasSessionFlag();
  storage()?.setItem(FLAG_KEY, "1");
  if (!wasSignedIn) notify(true);
}

export function clearSession() {
  const wasSignedIn = hasSessionFlag() || accessToken !== null;
  accessToken = null;
  expiresAt = 0;
  storage()?.removeItem(FLAG_KEY);
  if (wasSignedIn) notify(false);
}

/** One refresh at a time, shared by every caller that needs it. */
export function refreshSession(): Promise<string | null> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${apiUrl}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: "{}",
      });
      const body = (await res.json().catch(() => null)) as ApiEnvelope<AuthTokens> | null;
      if (!res.ok || !body?.success) {
        // 401/403: the refresh cookie is gone or revoked. Network errors keep the flag.
        if (res.status === 401 || res.status === 403) clearSession();
        return null;
      }
      setSession(body.data);
      return body.data.accessToken;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** A valid access token if the visitor is signed in, refreshing it when needed. */
export async function getAccessToken(): Promise<string | null> {
  if (accessToken && Date.now() < expiresAt - SKEW_MS) return accessToken;
  if (!hasSessionFlag()) return null;
  return refreshSession();
}

// ───────────── guest id (cart before sign-in) ─────────────

export function getGuestId(): string | null {
  return storage()?.getItem(GUEST_KEY) ?? null;
}

/** The guest id the API gave us (the API also keeps it as a cookie). */
export function rememberGuestId(guestId: string | null | undefined) {
  if (guestId) storage()?.setItem(GUEST_KEY, guestId);
}

export function forgetGuestId() {
  storage()?.removeItem(GUEST_KEY);
}
