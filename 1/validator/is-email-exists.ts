import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Injectable } from '@nestjs/common';
import { UserEntity } from '../entities/user.entity';

@ValidatorConstraint({ name: 'IsUrlRule', async: false })
@Injectable()
export class IsEmailExistsRule implements ValidatorConstraintInterface {

  async validate(email: string) {
    const findUserByEmail = await UserEntity.findOne({ email });

    return !findUserByEmail;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Email exists';
  }
}
