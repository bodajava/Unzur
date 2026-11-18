"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authApi, catalogApi } from "@/lib/api/endpoints";
import { qk } from "@/lib/api/hooks";
import { getGuestId, hasSessionFlag } from "@/lib/api/session";

/**
 * The page itself is prerendered, so the API doesn't see who is looking.
 * This records the view for this visitor ("Recently viewed").
 */
export function TrackView({ slug }: { slug: string }) {
  const client = useQueryClient();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!getGuestId() && !hasSessionFlag()) await authApi.guestSession();
        await catalogApi.product(slug);
        if (!cancelled) void client.invalidateQueries({ queryKey: qk.recentlyViewed });
      } catch {
        /* tracking is best effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, client]);
  return null;
}
