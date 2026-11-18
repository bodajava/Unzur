import type { Metadata } from "next";
import { MessagesInbox } from "@/components/admin/messages-inbox";
import { getDictionary } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.admin.messages.title };
}

export default function MessagesPage() {
  return <MessagesInbox />;
}
