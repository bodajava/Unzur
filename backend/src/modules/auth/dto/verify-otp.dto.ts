import { IsEmail } from 'class-validator';
import { IsOtpCode, NormalizeEmail } from '../../../common/decorators/index.js';

export class VerifyOtpDto {
  @NormalizeEmail()
  @IsEmail()
  email: string;

  @IsOtpCode()
  code: string;
}
