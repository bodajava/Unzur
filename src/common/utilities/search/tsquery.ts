/** Max words taken from a search string (keeps queries cheap). */
const MAX_TOKENS = 8;
const MAX_TOKEN_LENGTH = 50;

/**
 * Splits free text into safe search words: only Unicode letters and digits
 * survive, so tsquery operators (& | ! ( ) : * ' \ < >) can never reach
 * to_tsquery. Arabic diacritics (tashkeel) and Latin accents are removed.
 */
export function searchTokens(input: string | undefined | null): string[] {
  if (!input) return [];
  return input
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter(Boolean)
    .slice(0, MAX_TOKENS)
    .map((token) => token.slice(0, MAX_TOKEN_LENGTH));
}

/**
 * Prefix tsquery for search-as-you-type: "قهوة عر" -> "قهوة:* & عر:*".
 * Returns null when nothing searchable is left.
 */
export function toPrefixTsQuery(input: string | undefined | null): string | null {
  const tokens = searchTokens(input);
  return tokens.length ? tokens.map((t) => `${t}:*`).join(' & ') : null;
}

/** ILIKE pattern that matches `input` anywhere; % _ \ are escaped. */
export function toLikePattern(input: string): string {
  return `%${input.trim().slice(0, 100).replace(/[\\%_]/g, '\\$&')}%`;
}

/**
 * OR-prefix tsquery for free-text questions ("عندكم قهوة تركي؟"): any word may
 * match; words shorter than 2 letters are ignored.
 */
export function toAnyPrefixTsQuery(input: string | undefined | null): string | null {
  const tokens = searchTokens(input).filter((t) => t.length >= 2);
  return tokens.length ? tokens.map((t) => `${t}:*`).join(' | ') : null;
}
