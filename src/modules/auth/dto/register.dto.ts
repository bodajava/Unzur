import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsPhone, NormalizeEmail, Trim } from '../../../common/decorators/index.js';

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72; // bcrypt only uses the first 72 bytes

export class RegisterDto {
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(PASSWORD_MIN)
  @MaxLength(PASSWORD_MAX)
  password: string;

  /** Optional: sign-up is email + password. Defaults to the email's name part; editable later. */
  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  firstName?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(60)
  lastName?: string;

  @IsOptional()
  @Trim()
  @IsPhone()
  phone?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(32)
  referralCode?: string;
}
