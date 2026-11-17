import type { Dictionary } from "@/i18n/dictionaries/en";
import { ApiError } from "./client";

/**
 * What to show the visitor for a failed request: our own words for network
 * problems and expired sessions, otherwise the API's message (it explains
 * what to fix, e.g. "This email domain cannot receive email").
 */
export function errorMessage(error: unknown, t: Dictionary): string {
  if (error instanceof ApiError) {
    if (error.isNetwork) return t.errors.network;
    // 503 = a service we depend on is off (today: online payment through Paymob).
    if (error.status === 503) return t.errors.unavailable;
    if (error.status >= 500) return t.errors.generic;
    if (error.status === 401) return t.errors.sessionExpired;
    return error.message || t.errors.generic;
  }
  return t.errors.generic;
}
