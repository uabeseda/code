import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface, isURL } from 'class-validator';
import { Injectable } from '@nestjs/common';
import { BlackListEntity } from '../entities/black-list.entity';

@ValidatorConstraint({ name: 'IsUrlRule', async: false })
@Injectable()
export class IsUrlRule implements ValidatorConstraintInterface {
  private errorMessage = `Site is in black list`;

  async validate(value: string) {
    const urlParts = value.split('://');
    if (urlParts.length === 1) {
      value = 'http://' + value;
    }

    if (!isURL(value)) {
      this.errorMessage = 'Provided link is invalid';
      return false;
    }

    const url = new URL(value);
    let host = url.host.toLowerCase();
    if (host.startsWith('www.')) {
      host = host.replace('www.', '');
    }
    const blackListEntity = await BlackListEntity.findOne({ where: { link: host } });
    return !blackListEntity;
  }

  defaultMessage(args: ValidationArguments) {
    return this.errorMessage;
  }
}
