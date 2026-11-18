/** Shared validation patterns. */
export const Regex = {
  /** Egyptian mobile (01XXXXXXXXX) or international E.164-ish */
  PHONE: /^(?:\+?20)?01[0125][0-9]{8}$|^\+?[1-9][0-9]{7,14}$/,
  /** 8-72 chars, at least one letter and one digit */
  PASSWORD: /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/,
  OTP: /^[0-9]{6}$/,
  GUEST_ID: /^[A-Za-z0-9_-]{8,64}$/,
  SLUG: /^[a-z0-9؀-ۿ]+(?:-[a-z0-9؀-ۿ]+)*$/,
  SORT: /^-?[A-Za-z_]+(,-?[A-Za-z_]+)*$/,
} as const;
