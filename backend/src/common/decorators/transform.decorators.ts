import { Transform } from 'class-transformer';

/** Trim + lowercase (emails). */
export const NormalizeEmail = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );

export const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

/**
 * Multipart/query values arrive as strings. "" -> undefined, "null" -> null,
 * otherwise Number(value). NaN fails @IsInt().
 */
export const ToInt = () =>
  Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === '') return undefined;
    if (value === null || value === 'null') return null;
    return typeof value === 'string' ? Number(value) : value;
  });

/** "true"/"1" -> true, "false"/"0" -> false; anything else is left for @IsBoolean() to reject. */
export const ToBoolean = () =>
  Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === '') return undefined;
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return value;
  });

/**
 * Accepts repeated fields (a=1&a=2), a JSON array string ('["1","2"]')
 * or a comma list ("1,2").
 */
export const ToStringArray = () =>
  Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === '') return undefined;
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed) as unknown;
      } catch {
        return value;
      }
    }
    return trimmed.split(',').map((v) => v.trim()).filter(Boolean);
  });

/** "" -> undefined, "null" -> null (lets PATCH clear a nullable text field). */
export const ToNullableString = () =>
  Transform(({ value }: { value: unknown }) => {
    if (value === undefined) return undefined;
    if (value === null || value === 'null') return null;
    return typeof value === 'string' ? value.trim() : value;
  });
