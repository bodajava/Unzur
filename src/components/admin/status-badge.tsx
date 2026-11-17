"use client";

import { useI18n } from "@/i18n/client";
import type { OrderStatus, PaymentStatus } from "@/lib/api/types";

const ORDER_TONE: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "bg-[#f5b301]/15 text-[#a87900] dark:text-[#ffd45c]",
  CONFIRMED: "bg-blue/12 text-blue dark:bg-blue/25 dark:text-[#a3b3ff]",
  PREPARING: "bg-[#7b5cff]/14 text-[#5a3fe0] dark:text-[#b9a8ff]",
  SHIPPED: "bg-[#0ea5b7]/14 text-[#08788a] dark:text-[#6fe3f0]",
  DELIVERED: "bg-[#1f9d55]/14 text-[#16773f] dark:text-[#7ee2a8]",
  CANCELLED: "bg-ink/8 text-muted",
  REFUNDED: "bg-[#d1342f]/12 text-[#b02a26] dark:text-[#ff8f8a]",
};

const PAYMENT_TONE: Record<PaymentStatus, string> = {
  UNPAID: "text-muted",
  PENDING: "text-[#a87900] dark:text-[#ffd45c]",
  PAID: "text-[#16773f] dark:text-[#7ee2a8]",
  FAILED: "text-[#b02a26] dark:text-[#ff8f8a]",
  REFUNDED: "text-[#b02a26] dark:text-[#ff8f8a]",
  PARTIALLY_REFUNDED: "text-[#b02a26] dark:text-[#ff8f8a]",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useI18n();
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${ORDER_TONE[status]}`}>
      {t.orderStatus[status]}
    </span>
  );
}

export function PaymentStatusText({ status }: { status: PaymentStatus }) {
  const { t } = useI18n();
  return <span className={`text-xs font-semibold ${PAYMENT_TONE[status]}`}>{t.paymentStatus[status]}</span>;
}
