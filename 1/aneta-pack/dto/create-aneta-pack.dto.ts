import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsEmail,
  IsNumber,
  IsString,
} from 'class-validator';

export class CreateAnetaPackDto {

  @ApiProperty()
  @IsNumber()
  unitId: number;

  @ApiProperty({format: 'timestamp', example: 'YYYY-MM-DD HH:mm'})
  @IsString()
  startTime: string;

  @ApiProperty({required: false, example: ['aneta@anetaed.com']})
  @ArrayNotEmpty({ message: `Recipients' emails should not be empty` })
  @IsEmail({}, { each: true, always: false })
  readonly emails: string[];
}
