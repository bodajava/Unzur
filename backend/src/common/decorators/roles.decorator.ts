import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../enums/prisma.enums.js';

export const ROLES_KEY = 'roles';

/** RBAC: @Roles('ADMIN') or @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN) */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
