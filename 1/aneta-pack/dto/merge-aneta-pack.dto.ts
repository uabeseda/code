import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { CreateEventRequest } from '../../event/dto/create-event.request';
import { DigitalResourceDto } from '../../digital-resource/dto/digital-resource.dto';
import { Type } from 'class-transformer';
import { IsContainsDuplicates } from '../../validator/is-contains-duplicates';

export class MergeAnetaPackDto {
  @ApiProperty()
  @IsNumber()
  @IsOptional()
  readonly anetaPackId?: number;

  @ApiProperty()
  @IsObject()
  @ValidateNested({ each: true })
  readonly schedule: Map<number, CreateEventRequest[]>;

  @ApiProperty({ type: [DigitalResourceDto] })
  @IsArray()
  @IsContainsDuplicates()
  @ValidateNested({ each: true })
  @Type(() => DigitalResourceDto)
  digitalResources: DigitalResourceDto[];
}
