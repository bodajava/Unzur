import { registerDecorator, ValidateIf, type ValidationOptions } from 'class-validator';
import { IsOtpCodeConstraint } from '../validators/is-otp-code.constraint.js';
import { IsLessThanFieldConstraint } from '../validators/is-less-than-field.constraint.js';
import { IsPhoneConstraint } from '../validators/is-phone.constraint.js';

export function IsPhone(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: IsPhoneConstraint,
    });
}

export function IsOtpCode(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: IsOtpCodeConstraint,
    });
}

/** e.g. @IsLessThanField('basePrice') on salePrice */
export function IsLessThanField(field: string, options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      constraints: [field],
      validator: IsLessThanFieldConstraint,
    });
}

/**
 * Like @IsOptional() but only skips when the field is absent: an explicit
 * null is still validated (and rejected). Use on PATCH fields that are not
 * nullable in the database.
 */
export const OptionalNotNull = () =>
  ValidateIf((_object: object, value: unknown) => value !== undefined);
