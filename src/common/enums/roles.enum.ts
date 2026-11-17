import { UserRole } from '../../generated/prisma/enums.js';

/** Roles allowed into the admin dashboard. */
export const ADMIN_ROLES: readonly UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.STAFF,
];
