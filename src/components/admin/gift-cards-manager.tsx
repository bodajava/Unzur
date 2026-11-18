"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt, formatDate, formatPrice } from "@/i18n/format";
import { marketingApi, useGiftCards, useMarketingChange } from "@/lib/admin/api";
import type { AdminGiftCard } from "@/lib/admin/types";
import { ApiError } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { MONEY, toPiasters } from "./money";
import { Panel, Skeleton } from "./ui";

const field = "mt-1.5 w-full rounded-xl border border-ink/20 bg-transparent px-3.5 py-2.5 text-sm focus:border-ink focus:outline-none aria-[invalid=true]:border-[#d1342f]";

function IssueForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const tm = t.admin.marketing;
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [expires, setExpires] = useState("");
  const [bad, setBad] = useState(false);
  const issue = useMarketingChange("gift-cards", marketingApi.issueGiftCard);
  const serverErrors = issue.error instanceof ApiError && Array.isArray(issue.error.errors) ? (issue.error.errors as string[]) : [];
  return (
    <form
      noValidate
      className="rounded-2xl border border-ink/15 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const ok = MONEY.test(amount) && toPiasters(amount) >= 5000 && toPiasters(amount) <= 1_000_000;
        setBad(!ok);
        if (!ok) return;
        issue.mutate(
          {
            amountPiasters: toPiasters(amount),
            recipientEmail: recipient.trim() || undefined,
            message: message.trim() || undefined,
            expiresAt: expires ? `${expires}T23:59:59+02:00` : undefined,
          },
          { onSuccess: onDone },
        );
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          {tm.amount}
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" dir="ltr" aria-invalid={bad || undefined} className={`${field} rtl:text-right`} />
          <span className="mt-1 block text-xs font-normal text-muted">{tm.amountHint}</span>
        </label>
        <label className="text-sm font-semibold">
          {tm.expiresOn}
          <input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className={field} />
        </label>
        <label className="text-sm font-semibold">
          {tm.recipient}
          <input type="email" value={recipient} onChange={(e) => setRecipient(e.target.value)} dir="ltr" className={`${field} rtl:text-right`} />
        </label>
        <label className="text-sm font-semibold">
          {tm.giftMessage}
          <input value={message} maxLength={300} onChange={(e) => setMessage(e.target.value)} className={field} />
        </label>
      </div>
      {issue.isError && <p lang={serverErrors.length ? "en" : undefined} className="mt-3 text-xs text-[#d1342f]">{serverErrors.length ? serverErrors.join(" · ") : errorMessage(issue.error, t)}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onDone} className="rounded-full px-4 py-2 text-sm hover:bg-ink/8">{tm.cancel}</button>
        <button type="submit" disabled={issue.isPending} className="rounded-full bg-blue px-5 py-2 text-sm font-semibold text-haze hover:bg-blue-deep disabled:opacity-50">
          {issue.isPending ? tm.saving : tm.issue}
        </button>
      </div>
    </form>
  );
}

function Row({ card }: { card: AdminGiftCard }) {
  const { lang, t } = useI18n();
  const tm = t.admin.marketing;
  const toggle = useMarketingChange("gift-cards", () => marketingApi.updateGiftCard(card.id, { isActive: !card.isActive }));
  const unpaid = card.source === "PURCHASE" && card.paymentStatus !== "PAID";
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
      <span dir="ltr" className="font-mono font-semibold tracking-wide">{card.code ?? <span className="font-sans text-xs font-normal text-muted">{tm.hiddenCode}</span>}</span>
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${card.isActive ? "bg-[#1f9d55]/14 text-[#16773f] dark:text-[#7ee2a8]" : "bg-ink/8 text-muted"}`}>
        {unpaid ? tm.unpaid : card.isActive ? tm.active : tm.status.INACTIVE}
      </span>
      <span className="text-sm tabular-nums">
        {fmt(tm.balance, { balance: formatPrice(card.currentBalance, lang), initial: formatPrice(card.initialBalance, lang) })}
      </span>
      <span className="text-xs text-muted">
        {card.source === "ADMIN" ? tm.fromAdmin : tm.fromPurchase}
        {card.recipientEmail && <> · <span dir="ltr">{card.recipientEmail}</span></>}
        {card.expiresAt && <> · {tm.expires} {formatDate(card.expiresAt, lang)}</>}
      </span>
      {!unpaid && (
        <button type="button" disabled={toggle.isPending} onClick={() => toggle.mutate(undefined)} className="ms-auto rounded-full px-3 py-1.5 text-sm hover:bg-ink/8 disabled:opacity-50">
          {card.isActive ? tm.switchOff : tm.switchOn}
        </button>
      )}
      {toggle.isError && <p className="w-full text-xs text-[#d1342f]">{errorMessage(toggle.error, t)}</p>}
    </li>
  );
}

export function GiftCardsManager() {
  const { t } = useI18n();
  const tm = t.admin.marketing;
  const [page, setPage] = useState(1);
  const [issuing, setIssuing] = useState(false);
  const cards = useGiftCards({ page, limit: 20, sort: "-createdAt" });
  const data = cards.data;
  return (
    <Panel
      title={tm.giftCards}
      action={
        !issuing && (
          <button type="button" onClick={() => setIssuing(true)} className="rounded-full border border-ink/25 px-4 py-1.5 text-sm hover:border-ink">
            + {tm.issue}
          </button>
        )
      }
    >
      <p className="mb-4 text-sm text-muted">{tm.giftCardsHint}</p>
      {issuing && <div className="mb-4"><IssueForm onDone={() => setIssuing(false)} /></div>}
      {cards.isError && <p className="text-sm text-[#d1342f]">{errorMessage(cards.error, t)}</p>}
      {!data ? (
        <Skeleton className="h-32" />
      ) : data.items.length === 0 ? (
        <p className="text-sm text-muted">{tm.noGiftCards}</p>
      ) : (
        <ul className="divide-y divide-ink/10">
          {data.items.map((c) => <Row key={`${c.id}-${c.isActive}`} card={c} />)}
        </ul>
      )}
      {data && data.meta.totalPages > 1 && (
        <nav aria-label={t.shop.pagination} className="mt-4 flex items-center justify-between">
          <button type="button" disabled={!data.meta.hasPrevPage} onClick={() => setPage((p) => p - 1)} className="rounded-full border border-ink/25 px-4 py-1.5 text-sm disabled:opacity-30">{t.shop.prev}</button>
          <span className="text-xs text-muted tabular-nums">{data.meta.page} / {data.meta.totalPages}</span>
          <button type="button" disabled={!data.meta.hasNextPage} onClick={() => setPage((p) => p + 1)} className="rounded-full border border-ink/25 px-4 py-1.5 text-sm disabled:opacity-30">{t.shop.next}</button>
        </nav>
      )}
    </Panel>
  );
}
