import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class OverrideAnetaPackDto {
  @ApiProperty()
  @IsNumber()
  readonly anetaPackId: number;

  @ApiProperty({ format: 'timestamp', example: 'YYYY-MM-DD HH:mm' })
  @IsString()
  startTime: string;

  @ApiProperty({ required: true })
  @IsBoolean()
  readonly schedule: boolean;

  @ApiProperty({ required: true })
  @IsBoolean()
  readonly homeroom: boolean;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  repeat: number;

}
