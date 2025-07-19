import {
    registerDecorator,
    ValidationOptions,
    ValidatorConstraint,
    ValidatorConstraintInterface,
    ValidationArguments
} from 'class-validator';
import { sort_keys } from 'src/workshop/workshop.service';

@ValidatorConstraint({ async: false })
export class IsBooleanCustomConstraint implements ValidatorConstraintInterface {
    validate(value: unknown) {
        return value === 'true' || value === 'false';
    }

    defaultMessage(args: ValidationArguments) {
        return `${args.property} property must be a boolean represented as \`true\` or \`false\``;
    }
}

export function IsBooleanStr(validationOptions?: ValidationOptions) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            constraints: [],
            validator: IsBooleanCustomConstraint
        });
    };
}

@ValidatorConstraint({ async: false })
export class IsSortConstraint implements ValidatorConstraintInterface {
    validate(value: string) {
        return sort_keys.includes(value);
    }

    defaultMessage(args: ValidationArguments) {
        return `${args.property} property must have one of [${sort_keys.join(', ')}] values, but ${args.value} was provided instead`;
    }
}

export function IsSort(validationOptions?: ValidationOptions) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            constraints: [],
            validator: IsSortConstraint
        });
    };
}

@ValidatorConstraint({ async: false })
export class IsDivisibleConstraint implements ValidatorConstraintInterface {
    validate(value: number, args: ValidationArguments) {
        const [baseWidth] = args.constraints;
        return value % baseWidth === 0;
    }

    defaultMessage(args: ValidationArguments) {
        const [baseWidth] = args.constraints;
        return `${args.property} property must be integers divisible by ${baseWidth}`;
    }
}

export function IsDivisible(
    baseWidth: number,
    validationOptions?: ValidationOptions
) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            constraints: [baseWidth],
            validator: IsDivisibleConstraint
        });
    };
}

