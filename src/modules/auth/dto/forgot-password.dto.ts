import { IsEmail } from 'class-validator';
import { NormalizeEmail } from '../../../common/decorators/index.js';

export class ForgotPasswordDto {
  @NormalizeEmail()
  @IsEmail()
  email: string;
}
