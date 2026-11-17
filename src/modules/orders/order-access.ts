import { ADMIN_ROLES } from '../../common/enums/index.js';
import type { AuthUser } from '../../common/interfaces/auth.interface.js';
import { contactMatches } from '../../common/utilities/phone.js';

/**
 * Who may see/act on an order: staff, the account that owns it, or anyone
 * who knows the order's email/phone (`contact`). Callers answer 404 when this
 * is false, so order ids/numbers cannot be probed.
 */
export function canAccessOrder(
  order: { userId: string | null; customerEmail: string; customerPhone: string },
  user: AuthUser | undefined,
  contact: string | undefined,
): boolean {
  if (user && ADMIN_ROLES.includes(user.role)) return true;
  if (user && order.userId === user.id) return true;
  return !!contact && contactMatches(contact, order);
}
