"use client";

/**
 * A <script> that runs while the HTML is parsed (before first paint) and is
 * inert when React renders on the client (no "script tag" warning, no re-run).
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
