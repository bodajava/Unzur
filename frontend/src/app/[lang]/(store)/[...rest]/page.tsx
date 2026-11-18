import { notFound } from "next/navigation";

/** A 404 is allowed to block; skip instant-navigation validation. */
export const instant = false;

/** Any path under /en or /ar that has no page yet gets the localized 404. */
export default function CatchAll() {
  notFound();
}
