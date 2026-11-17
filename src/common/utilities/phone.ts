/**
 * Canonical form for comparing phone numbers: digits only, Egyptian
 * numbers as 01XXXXXXXXX ("+20 100-123-4567", "00201001234567" -> "01001234567").
 */
export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('0020')) return `0${digits.slice(4)}`;
  if (digits.startsWith('20') && digits.length === 12) return `0${digits.slice(2)}`;
  return digits;
}

/** True when `contact` (email or phone) matches the order's email or phone. */
export function contactMatches(
  contact: string,
  order: { customerEmail: string; customerPhone: string },
): boolean {
  const value = contact.trim();
  if (!value) return false;
  if (value.includes('@')) return value.toLowerCase() === order.customerEmail.toLowerCase();
  const phone = normalizePhone(value);
  return phone.length >= 8 && phone === normalizePhone(order.customerPhone);
}
