import {
  registerDecorator,
  ValidationArguments, ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Injectable } from '@nestjs/common';
import { DigitalResourceEntity } from '../entities/digital-resource.entity';
import { REQUEST_CONTEXT } from '../interceptors/inject-values-to-context-interceptor';

@ValidatorConstraint({ name: 'IsDigitalResourceExistsRule', async: false })
@Injectable()
export class IsDigitalResourceExistsRule implements ValidatorConstraintInterface {

  async validate(link: string, args: ContextValidationArguments) {
    let unitId: number | undefined;
    if (args.object[REQUEST_CONTEXT]) {
      unitId = args.object[REQUEST_CONTEXT].unitId;
    }
    const digitalResource = await DigitalResourceEntity.findOne({ link, unitId });
    return !digitalResource;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Digital resource already exists';
  }
}

export interface ContextValidationArguments extends ValidationArguments {
  object: {
    [REQUEST_CONTEXT]: {
      unitId: number;
    };
  };
}

export function IsDigitalResourceExists(validationOptions?: ValidationOptions) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      name: 'IsDigitalResourceExists',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: IsDigitalResourceExistsRule,
    });
  };
}
