import type { Dictionary } from "@/i18n/dictionaries/en";
import { API_ERRORS_AR, API_STATUS_AR } from "@/i18n/api-errors.ar";
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
    if (t.locale === "ar") return arabicApiMessage(error) ?? t.errors.generic;
    return error.message || t.errors.generic;
  }
  return t.errors.generic;
}

/** The API speaks English: on Arabic pages, translate the message (or say something plain by status). */
function arabicApiMessage(error: ApiError): string | null {
  const message = error.message ?? "";
  if (/[\u0600-\u06FF]/.test(message)) return message;
  for (const [pattern, text] of API_ERRORS_AR) {
    const m = message.match(pattern);
    if (m) return text.replace(/\$(\d)/g, (_, i: string) => m[Number(i)] ?? "");
  }
  return API_STATUS_AR[error.status] ?? null;
}
