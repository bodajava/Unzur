/**
 * The contact used for the last order, kept for this tab only so the
 * confirmation page can load the order without putting an email in the URL.
 */
const KEY = "unzur_last_order";

export function rememberOrder(orderNumber: string, contact: string) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ orderNumber, contact }));
  } catch {
    /* private mode: the visitor can still use the track form */
  }
}

export function recallOrder(orderNumber?: string | null): string | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as { orderNumber: string; contact: string } | null;
    if (!saved) return null;
    return !orderNumber || saved.orderNumber.toUpperCase() === orderNumber.toUpperCase() ? saved.contact : null;
  } catch {
    return null;
  }
}
