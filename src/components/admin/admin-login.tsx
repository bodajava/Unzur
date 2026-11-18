"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useI18n } from "@/i18n/client";
import { useAdminLogin } from "@/lib/admin/api";
import { STAFF_ROLES } from "@/lib/admin/types";
import { ApiError } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { useSession } from "@/lib/api/hooks";

export function AdminLogin() {
  const { t, href } = useI18n();
  const router = useRouter();
  const search = useSearchParams();
  const uid = useId();
  const login = useAdminLogin();
  const { user } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);

  // Only follow "next" inside the dashboard.
  const next = search.get("next");
  const target = next && next.startsWith(href("/admin")) ? next : href("/admin");

  useEffect(() => {
    if (user && STAFF_ROLES.includes(user.role)) router.replace(target);
  }, [user, router, target]);

  const input =
    "mt-2 w-full rounded-xl border border-ink/25 bg-transparent px-4 py-3 hover:border-ink/50 focus:border-ink focus:outline-none";

  return (
    <div className="grid min-h-svh place-items-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between">
          <Logo title="UNZUR" className="h-8 w-auto" />
          <div className="flex items-center gap-4 text-sm">
            <LanguageSwitch />
            <ThemeToggle />
          </div>
        </div>
        <h1 className="display mt-12 text-5xl">{t.admin.login.title}</h1>
        <p className="mt-3 text-sm text-muted">{t.admin.login.intro}</p>
        <form
          className="mt-8"
          onSubmit={(e) => {
            e.preventDefault();
            login.mutate({ email: email.trim(), password }, { onSuccess: () => router.replace(target) });
          }}
        >
          <label htmlFor={`${uid}-e`} className="text-sm font-semibold">
            {t.admin.login.email}
          </label>
          <input
            id={`${uid}-e`}
            type="email"
            dir="ltr"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${input} rtl:text-right`}
          />
          <label htmlFor={`${uid}-p`} className="mt-5 block text-sm font-semibold">
            {t.admin.login.password}
          </label>
          <div className="relative">
            <input
              id={`${uid}-p`}
              type={show ? "text" : "password"}
              dir="ltr"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${input} pe-20 rtl:text-right`}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="nav-link absolute end-4 top-1/2 mt-1 -translate-y-1/2 text-xs"
              aria-pressed={show}
            >
              {show ? t.admin.login.hide : t.admin.login.show}
            </button>
          </div>
          <button
            type="submit"
            disabled={login.isPending}
            className="mt-8 w-full rounded-full bg-blue px-6 py-3.5 font-semibold text-haze hover:bg-blue-deep disabled:opacity-60"
          >
            {login.isPending ? t.admin.login.submitting : t.admin.login.submit}
          </button>
          <p role="alert" className="mt-3 min-h-5 text-sm text-[#d1342f]">
            {login.isError &&
              (login.error instanceof ApiError && login.error.status === 401
                ? t.admin.login.wrong
                : errorMessage(login.error, t))}
          </p>
        </form>
      </div>
    </div>
  );
}
