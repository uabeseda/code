import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Validate,
} from 'class-validator';
import { IsEmailExistsRule } from '../../validator/is-email-exists';

export class RegistrationRequest {
  @ApiProperty()
  @IsEmail({}, { message: 'Email is not valid' })
  @Validate(IsEmailExistsRule)
  readonly email: string;

  @ApiProperty()
  @IsNotEmpty()
  readonly password: string;

  @ApiProperty()
  @IsNotEmpty()
  readonly userType: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  readonly referralOwnerId?: number;
}
