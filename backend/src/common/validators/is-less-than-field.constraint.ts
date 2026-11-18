import {
  type ValidationArguments,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

/**
 * value < object[otherField]. Passes when either side is missing, so it can
 * be used on optional fields (the service re-checks against stored values).
 */
@ValidatorConstraint({ name: 'isLessThanField', async: false })
export class IsLessThanFieldConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const [field] = args.constraints as [string];
    const other = (args.object as Record<string, unknown>)[field];
    if (typeof value !== 'number' || typeof other !== 'number') return true;
    return value < other;
  }

  defaultMessage(args: ValidationArguments): string {
    const [field] = args.constraints as [string];
    return `$property must be less than ${field}`;
  }
}
