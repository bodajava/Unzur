import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { IsOtpCode, NormalizeEmail } from '../../../common/decorators/index.js';
import { PASSWORD_MAX, PASSWORD_MIN } from './register.dto.js';

export class ResetPasswordDto {
  @NormalizeEmail()
  @IsEmail()
  email: string;

  @IsOtpCode()
  code: string;

  @IsString()
  @MinLength(PASSWORD_MIN)
  @MaxLength(PASSWORD_MAX)
  newPassword: string;
}
