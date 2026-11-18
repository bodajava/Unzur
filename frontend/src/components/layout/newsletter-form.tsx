"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { errorMessage } from "@/lib/api/errors";
import { useSubscribe } from "@/lib/api/hooks";

/** API 7.1 */
export function NewsletterForm() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const subscribe = useSubscribe();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (email.trim()) subscribe.mutate(email.trim());
      }}
      className="w-full"
      noValidate
    >
      <label htmlFor="newsletter-email" className="sr-only">
        {t.newsletter.label}
      </label>
      <div className="flex items-center gap-3 border-b-2 border-ink pb-2">
        <input
          id="newsletter-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.newsletter.placeholder}
          aria-describedby="newsletter-status"
          className="w-full bg-transparent text-[0.95rem] placeholder:text-ink/40 focus:outline-none"
        />
        <button type="submit" disabled={subscribe.isPending} className="nav-link shrink-0 disabled:opacity-50">
          {subscribe.isPending ? t.newsletter.submitting : t.newsletter.submit}
        </button>
      </div>
      <p id="newsletter-status" role="status" className="mt-2 min-h-5 text-xs text-muted">
        {subscribe.isSuccess && t.newsletter[subscribe.data.result]}
        {subscribe.isError && errorMessage(subscribe.error, t)}
      </p>
    </form>
  );
}
