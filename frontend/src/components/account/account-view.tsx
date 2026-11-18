"use client";

import { useSyncExternalStore } from "react";
import { useSession } from "@/lib/api/hooks";
import { useI18n } from "@/i18n/client";
import { AccountHome } from "./account-home";
import { AuthPanel } from "./auth-panel";

const noop = () => () => {};

/** "My account": sign in / sign up when signed out, the account itself when signed in. */
export function AccountView() {
  const { t } = useI18n();
  const { user, status } = useSession();
  // The session flag is only readable after hydration: don't flash the sign-in form at signed-in people.
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  if (!hydrated || status === "loading") {
    return <div role="status" aria-label={t.shop.loading} className="h-96 animate-pulse rounded-2xl bg-panel" />;
  }
  return user ? <AccountHome user={user} /> : <AuthPanel />;
}
