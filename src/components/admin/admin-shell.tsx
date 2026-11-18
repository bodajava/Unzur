"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { EyeMark } from "@/components/brand/logo";
import { useI18n } from "@/i18n/client";
import { useLogout, useSession } from "@/lib/api/hooks";
import { STAFF_ROLES } from "@/lib/admin/types";
import { AdminHeader } from "./admin-header";
import { PushToast } from "./push-toast";

const noop = () => () => {};

function Centered({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="grid min-h-svh place-items-center px-6 text-center">
      <div className="max-w-sm">
        <EyeMark idle className="mx-auto w-16 text-ink" />
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}

/**
 * Every dashboard page: only staff, admins and the owner get in. Visitors who
 * aren't signed in go to the sign-in page and come back after.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const { t, href } = useI18n();
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { user, status } = useSession();
  const logout = useLogout();
  const onLogin = pathname.endsWith("/admin/login");
  const allowed = !!user && STAFF_ROLES.includes(user.role);
  // The session flag is only readable after hydration; until then everyone looks like a guest.
  const hydrated = useSyncExternalStore(noop, () => true, () => false);

  useEffect(() => {
    if (hydrated && !onLogin && status === "guest") {
      // Keep the whole address (filters in the query string) for the way back.
      const back = `${pathname}${window.location.search}`;
      router.replace(`${href("/admin/login")}?next=${encodeURIComponent(back)}`);
    }
  }, [hydrated, onLogin, status, router, href, pathname]);

  const signOut = () => logout.mutate(undefined, { onSettled: () => router.replace(href("/admin/login")) });

  if (onLogin) return <main id="main">{children}</main>;
  if (status !== "authenticated") return <Centered><p className="text-muted">{t.admin.guard.checking}</p></Centered>;
  if (!allowed) {
    return (
      <Centered>
        <p className="font-semibold">{t.admin.guard.noAccess}</p>
        <button type="button" onClick={signOut} className="nav-link mt-6 inline-block">
          {t.admin.guard.switch}
        </button>
      </Centered>
    );
  }
  return (
    <>
      <AdminHeader user={user} onSignOut={signOut} />
      <main id="main" className="min-h-svh px-4 pt-28 pb-20 sm:px-8 sm:pt-32 lg:px-12">
        <div className="mx-auto max-w-[90rem]">{children}</div>
      </main>
      <PushToast />
    </>
  );
}
