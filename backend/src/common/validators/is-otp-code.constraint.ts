import {
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { Regex } from '../utilities/regex/regex.js';

@ValidatorConstraint({ name: 'isOtpCode', async: false })
export class IsOtpCodeConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && Regex.OTP.test(value);
  }

  defaultMessage(): string {
    return '$property must be a 6-digit code';
  }
}
