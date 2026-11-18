"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { onPushMessage } from "@/lib/push";

type Toast = { title?: string; body?: string; url?: string; at: number };

/**
 * While the dashboard is open, a push (new order, message, low stock) refreshes
 * the lists and shows a small card in the corner for a few seconds.
 */
export function PushToast() {
  const { t } = useI18n();
  const client = useQueryClient();
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(
    () =>
      onPushMessage((data) => {
        void client.invalidateQueries({ queryKey: ["admin"] });
        setToast({ ...data, at: Date.now() });
      }),
    [client],
  );

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(id);
  }, [toast]);

  if (!toast) return null;
  const path = toast.url ? new URL(toast.url, location.origin).pathname + new URL(toast.url, location.origin).search : null;
  return (
    <div role="status" aria-live="polite" className="fixed end-4 bottom-4 z-[80] w-[min(22rem,calc(100vw-2rem))] rounded-2xl bg-blue p-4 text-haze shadow-2xl">
      <p className="font-semibold">{toast.title}</p>
      {toast.body && <p className="mt-1 text-sm opacity-85">{toast.body}</p>}
      <div className="mt-3 flex justify-end gap-4 text-sm">
        <button type="button" onClick={() => setToast(null)} className="opacity-80 hover:opacity-100">
          ✕
        </button>
        {path && (
          <Link href={path} onClick={() => setToast(null)} className="font-semibold underline-offset-4 hover:underline">
            {t.push.toastOpen} {t.common.arrow}
          </Link>
        )}
      </div>
    </div>
  );
}
