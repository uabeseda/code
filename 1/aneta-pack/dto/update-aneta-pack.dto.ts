import { PartialType } from '@nestjs/mapped-types';
import { CreateAnetaPackDto } from './create-aneta-pack.dto';

export class UpdateAnetaPackDto extends PartialType(CreateAnetaPackDto) {}
