const HEX = /^#[0-9a-f]{6}$/i;

/** A version's swatch colour ("#rrggbb", kept in attributes.color), or "" when it has none. */
export function colorOf(attributes: unknown): string {
  const c = attributes && typeof attributes === "object" ? (attributes as Record<string, unknown>).color : undefined;
  return typeof c === "string" && HEX.test(c) ? c.toLowerCase() : "";
}

/** True for light colours that need a visible outline on a light page (white, cream…). */
export function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 200;
}
