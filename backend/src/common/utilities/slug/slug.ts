import { ConflictException } from '@nestjs/common';


/**
 * URL slug that keeps Arabic letters: "قهوة عربية Coffee!" -> "قهوة-عربية-coffee"
 */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[ً-ٰٟ]/g, '') // Arabic diacritics
    .replace(/[̀-ͯ]/g, '') // Latin diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9؀-ۿ]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/**
 * Returns a slug not taken yet: base, base-2, base-3, ...
 * `exists` is usually a repository check.
 */
export async function uniqueSlug(
  input: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(input) || 'item';
  let candidate = base;
  for (let i = 2; await exists(candidate); i++) {
    candidate = `${base}-${i}`;
  }
  return candidate;
}

/**
 * Slug for a create/update:
 *  - explicit `slug` wins (409 if another row already uses it)
 *  - else a new unique slug from `name` when creating or when the name changed
 *  - else undefined (keep the current slug)
 * `exists` must ignore the row being updated.
 */
export async function resolveSlug(
  input: { slug?: string; name?: string },
  current: { slug: string; name: string } | null,
  exists: (slug: string) => Promise<boolean>,
): Promise<string | undefined> {
  if (input.slug) {
    if (input.slug === current?.slug) return undefined;
    if (await exists(input.slug)) {
      throw new ConflictException('This slug is already in use');
    }
    return input.slug;
  }
  if (input.name && (!current || input.name !== current.name)) {
    return uniqueSlug(input.name, exists);
  }
  return undefined;
}
