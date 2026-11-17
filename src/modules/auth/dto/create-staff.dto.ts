import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsPhone, NormalizeEmail, Trim } from '../../../common/decorators/index.js';
import { UserRole } from '../../../common/enums/index.js';
import { PASSWORD_MAX, PASSWORD_MIN } from './register.dto.js';

export const STAFF_ROLES = [UserRole.STAFF, UserRole.ADMIN] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export class CreateStaffDto {
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(PASSWORD_MIN)
  @MaxLength(PASSWORD_MAX)
  password: string;

  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  firstName: string;

  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  lastName: string;

  @IsOptional()
  @Trim()
  @IsPhone()
  phone?: string;

  @IsIn(STAFF_ROLES, { message: 'role must be STAFF or ADMIN' })
  role: StaffRole;
}
