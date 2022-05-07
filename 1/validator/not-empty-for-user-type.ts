import {
  isString,
  registerDecorator,
  ValidationArguments, ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Injectable } from '@nestjs/common';
import { REQUEST_CONTEXT } from '../interceptors/inject-values-to-context-interceptor';
import { UserType } from '../types';

@ValidatorConstraint({ name: 'NotEmptyForTeacherRule', async: false })
@Injectable()
export class NotEmptyForTeacherRule implements ValidatorConstraintInterface {
  private errorMessage;

  async validate(array: string[], args: ContextValidationArguments) {
    let userType: UserType | undefined;
    if (args.object[REQUEST_CONTEXT]) {
      userType = args.object[REQUEST_CONTEXT].userType;
    }

    if ([UserType.TEACHER, UserType.ANETA_TEACHER].includes(userType) && (!array || array.length === 0)) {
      this.errorMessage = `${args.property} should not be empty`;
      return false;
    } else {
      if (array && Array.isArray(array)) {
        for (const string of array) {
          if (isString(string)) {
            return true;
          } else {
            this.errorMessage = `each value in ${args.property} must be a string`;
            return false;
          }
        }
      }
      return true;
    }
  }

  defaultMessage(args: ValidationArguments) {
    return this.errorMessage;
  }
}

export interface ContextValidationArguments extends ValidationArguments {
  object: {
    [REQUEST_CONTEXT]: {
      userType: UserType;
    };
  };
}

export function NotEmptyForTeacher(validationOptions?: ValidationOptions) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      name: 'NotEmptyForTeacher',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: NotEmptyForTeacherRule,
    });
  };
}
