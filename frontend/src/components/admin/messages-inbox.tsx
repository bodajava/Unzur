"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt, formatDate, formatDateTime } from "@/i18n/format";
import { marketingApi, useMessageChange, useMessages } from "@/lib/admin/api";
import { ADMIN_ROLES, type ContactMessage } from "@/lib/admin/types";
import { errorMessage } from "@/lib/api/errors";
import { useSession } from "@/lib/api/hooks";
import { PageTitle, Skeleton } from "./ui";

/** Contact-form messages: unread first, with reply shortcuts (email, WhatsApp). */
export function MessagesInbox() {
  const { t } = useI18n();
  const tm = t.admin.messages;
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const list = useMessages({ page, limit: 20, isRead: unreadOnly ? false : undefined, sort: "-createdAt" });
  const data = list.data;

  return (
    <div>
      <PageTitle>{tm.title}</PageTitle>
      <div role="tablist" aria-label={tm.title} className="mb-6 inline-flex rounded-full border border-ink/20 p-1 text-sm">
        {[false, true].map((u) => (
          <button
            key={String(u)}
            type="button"
            role="tab"
            aria-selected={unreadOnly === u}
            onClick={() => {
              setUnreadOnly(u);
              setPage(1);
            }}
            className={`rounded-full px-4 py-1.5 transition-colors ${unreadOnly === u ? "bg-ink text-canvas" : "hover:bg-ink/8"}`}
          >
            {u ? tm.unread : tm.all}
          </button>
        ))}
      </div>

      {list.isError && <p className="mb-6 text-sm text-[#d1342f]">{errorMessage(list.error, t)}</p>}
      {!data ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <p className="rounded-2xl bg-panel px-6 py-16 text-center text-muted">{unreadOnly ? tm.emptyUnread : tm.empty}</p>
      ) : (
        <>
          <ul className={`space-y-3 transition-opacity ${list.isFetching ? "opacity-70" : ""}`}>
            {data.items.map((m) => (
              <Message key={m.id} m={m} />
            ))}
          </ul>
          {data.meta.totalPages > 1 && (
            <nav aria-label={t.shop.pagination} className="mt-8 flex items-center justify-between">
              <button type="button" disabled={!data.meta.hasPrevPage} onClick={() => setPage((p) => p - 1)} className="rounded-full border border-ink/25 px-5 py-2 text-sm disabled:opacity-30">
                {t.shop.prev}
              </button>
              <span className="text-sm text-muted tabular-nums">
                {data.meta.page} / {data.meta.totalPages}
              </span>
              <button type="button" disabled={!data.meta.hasNextPage} onClick={() => setPage((p) => p + 1)} className="rounded-full border border-ink/25 px-5 py-2 text-sm disabled:opacity-30">
                {t.shop.next}
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function Message({ m }: { m: ContactMessage }) {
  const { lang, t } = useI18n();
  const tm = t.admin.messages;
  const { user } = useSession();
  const update = useMessageChange((body: { isRead?: boolean; replied?: boolean }) => marketingApi.updateMessage(m.id, body));
  const remove = useMessageChange(() => marketingApi.deleteMessage(m.id));
  const canDelete = !!user && ADMIN_ROLES.includes(user.role);
  const phone = m.phone?.replace(/[^\d+]/g, "");
  const subject = encodeURIComponent(`Re: ${m.subject ?? ""}`.trim());
  const pill = "rounded-full border border-ink/20 px-3.5 py-1.5 text-xs font-semibold transition-colors hover:border-ink disabled:opacity-50";

  return (
    <li className={`rounded-2xl p-5 ${m.isRead ? "bg-panel" : "bg-blue/[0.07] ring-1 ring-blue/25"} dark:ring-white/8`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="font-semibold">
            {!m.isRead && <span className="me-2 rounded-full bg-blue px-2 py-0.5 text-[0.65rem] text-haze">{tm.new}</span>}
            <span dir="auto">{m.name}</span>
          </p>
          <p dir="ltr" className="text-xs text-muted rtl:text-right">
            {m.email}
            {m.phone && ` · ${m.phone}`}
          </p>
        </div>
        <p className="text-xs text-muted tabular-nums">{formatDateTime(m.createdAt, lang)}</p>
      </div>
      <p dir="auto" className="mt-3 text-sm font-semibold">
        {m.subject || <span className="text-muted">{tm.noSubject}</span>}
      </p>
      <p dir="auto" className="mt-1 text-sm whitespace-pre-line">
        {m.message}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a href={`mailto:${m.email}?subject=${subject}`} onClick={() => !m.isRead && update.mutate({ isRead: true })} className={pill}>
          {tm.reply}
        </a>
        {phone && (
          <a href={`https://wa.me/${phone.replace(/^\+/, "").replace(/^0/, "20")}`} target="_blank" rel="noopener noreferrer" className={pill}>
            {tm.whatsapp}
          </a>
        )}
        <button type="button" disabled={update.isPending} onClick={() => update.mutate({ isRead: !m.isRead })} className={pill}>
          {m.isRead ? tm.markUnread : tm.markRead}
        </button>
        {m.repliedAt ? (
          <span className="text-xs text-[#16773f] dark:text-[#7ee2a8]">✓ {fmt(tm.replied, { date: formatDate(m.repliedAt, lang) })}</span>
        ) : (
          <button type="button" disabled={update.isPending} onClick={() => update.mutate({ replied: true })} className={pill}>
            {tm.markReplied}
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            disabled={remove.isPending}
            onClick={() => window.confirm(tm.confirmRemove) && remove.mutate(undefined)}
            className="ms-auto text-xs text-[#b02a26] hover:underline disabled:opacity-50 dark:text-[#ff8f8a]"
          >
            {tm.remove}
          </button>
        )}
      </div>
      {(update.isError || remove.isError) && <p className="mt-2 text-xs text-[#d1342f]">{errorMessage(update.error ?? remove.error, t)}</p>}
    </li>
  );
}
