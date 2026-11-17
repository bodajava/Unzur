"use client";

import { useState } from "react";
import { useSubscribe } from "@/lib/api/hooks";

const DONE = {
  CREATED: "You're on the list. Check your inbox.",
  REACTIVATED: "Welcome back. You're subscribed again.",
  ALREADY_SUBSCRIBED: "You're already on the list.",
} as const;

/** API 7.1 */
export function NewsletterForm() {
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
        Email address
      </label>
      <div className="flex items-center gap-3 border-b-2 border-blue pb-2">
        <input
          id="newsletter-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          aria-describedby="newsletter-status"
          className="w-full bg-transparent text-[0.95rem] placeholder:text-blue/40 focus:outline-none"
        />
        <button type="submit" disabled={subscribe.isPending} className="nav-link shrink-0 disabled:opacity-50">
          {subscribe.isPending ? "Subscribing…" : "Subscribe"}
        </button>
      </div>
      <p id="newsletter-status" role="status" className="mt-2 min-h-5 text-xs text-ash">
        {subscribe.isSuccess && DONE[subscribe.data.result]}
        {subscribe.isError && subscribe.error.message}
      </p>
    </form>
  );
}
