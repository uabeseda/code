import {
  registerDecorator,
  ValidationArguments, ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Injectable } from '@nestjs/common';
import { DigitalResourceDto } from '../digital-resource/dto/digital-resource.dto';

@ValidatorConstraint({ name: 'IsContainsDuplicatesRule', async: false })
@Injectable()
export class IsContainsDuplicatesRule implements ValidatorConstraintInterface {

  async validate(digitalResources: DigitalResourceDto[], args: ValidationArguments) {
    let valuesAlreadySeen = [];

    for (let i = 0; i < digitalResources.length; i++) {
      let value = digitalResources[i];
      if (valuesAlreadySeen.indexOf(value.link) !== -1) {
        return false;
      }
      valuesAlreadySeen.push(value.link);
    }

    return true;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Digital resources contain duplicates';
  }
}

export function IsContainsDuplicates(validationOptions?: ValidationOptions) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      name: 'IsContainsDuplicates',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: IsContainsDuplicatesRule,
    });
  };
}
