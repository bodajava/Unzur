"use client";

import Link from "next/link";
import { useEffect } from "react";
import type { CategoryNode } from "@/lib/api/types";
import { site } from "@/lib/site";

export function MobileMenu({
  open,
  onClose,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  categories: CategoryNode[];
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const links = [
    { href: "/#pieces", label: "Best sellers" },
    ...categories.map((c) => ({ href: `/category/${c.slug}`, label: c.name })),
    { href: "/account", label: "Account" },
  ];

  return (
    <div
      id="mobile-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      className="fixed inset-0 z-[60] flex flex-col bg-blue px-6 pb-10 pt-6 text-haze"
    >
      <div className="flex items-center justify-between">
        <span className="wordmark text-[2.5rem]">{site.name}</span>
        <button type="button" onClick={onClose} className="nav-link" autoFocus>
          Close
        </button>
      </div>
      <nav aria-label="Mobile" className="mt-auto">
        <ul className="space-y-2">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} onClick={onClose} className="display block text-[clamp(2.25rem,11vw,3.5rem)]">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <p lang="ar" className="mt-10 text-pale">
          {site.taglineAr}
        </p>
      </nav>
    </div>
  );
}
