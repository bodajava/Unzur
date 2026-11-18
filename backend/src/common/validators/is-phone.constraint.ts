import {
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { Regex } from '../utilities/regex/regex.js';

@ValidatorConstraint({ name: 'isPhone', async: false })
export class IsPhoneConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && Regex.PHONE.test(value.replace(/[\s-]/g, ''));
  }

  defaultMessage(): string {
    return '$property must be a valid phone number';
  }
}
