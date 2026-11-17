"use client";

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { CartSummary, Suggestion, SubscribeResult } from "./types";

/** 3.1 Cart badge (guest or logged-in). */
export function useCartSummary() {
  return useQuery({
    queryKey: ["cart"],
    queryFn: () => api<CartSummary>("/cart"),
    staleTime: 30_000,
    retry: 1,
  });
}

/** 16.1 Search-as-you-type. */
export function useSearchSuggest(q: string) {
  const query = q.trim();
  return useQuery({
    queryKey: ["suggest", query],
    queryFn: () => api<Suggestion[]>(`/search/suggest?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 2,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

/** 7.1 Newsletter. */
export function useSubscribe() {
  return useMutation({
    mutationFn: (email: string) =>
      api<SubscribeResult>("/newsletter/subscribe", { method: "POST", body: JSON.stringify({ email }) }),
  });
}
