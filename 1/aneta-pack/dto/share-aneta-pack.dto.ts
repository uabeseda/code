import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsEmail } from 'class-validator';

export class ShareAnetaPackDto {
  @ApiProperty({ required: true, example: ['aneta@anetaed.com'] })
  @IsArray()
  @ArrayNotEmpty({ message: `Recipients' emails should not be empty` })
  @IsEmail({}, { each: true })
  readonly emails: string[];
}
