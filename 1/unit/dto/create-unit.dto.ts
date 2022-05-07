import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { UserType } from '../../types';
import { NotEmptyForTeacher } from '../../validator/not-empty-for-user-type';

export class CreateUnitDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  readonly name: string;

  @ApiProperty()
  @IsString({ each: true })
  @ArrayNotEmpty()
  readonly grades: string[];

  @ApiProperty()
  @NotEmptyForTeacher()
  readonly skills: string[];

  @ApiProperty()
  @NotEmptyForTeacher()
  readonly interests: string[];

  @ApiProperty()
  @IsOptional()
  @IsString()
  readonly avatar?: string;

  @ApiProperty()
  @IsOptional()
  @IsObject()
  settings?: object;
}
