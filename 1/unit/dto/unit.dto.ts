import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsNotEmpty, IsOptional } from 'class-validator';
import { UnitEntity } from '../../entities/unit.entity';

export class UnitDto {
  constructor(entity: UnitEntity) {
    if (!entity) {
      return this;
    }
    this.id = entity.id;
    this.name = entity.name;
    this.grades = entity.grades;
    this.skills = entity.skills;
    this.interests = entity.interests;
    this.avatar = entity.avatar;
    this.settings = entity.settings;
  }

  @ApiProperty()
  readonly id?: number;

  @ApiProperty()
  @IsNotEmpty()
  readonly name: string;

  @ApiProperty()
  @ArrayNotEmpty()
  readonly grades: string[];

  @ApiProperty()
  @ArrayNotEmpty()
  readonly skills: string[];

  @ApiProperty()
  @ArrayNotEmpty()
  readonly interests: string[];

  @ApiProperty()
  readonly avatar: string;

  @ApiProperty()
  readonly settings: object;

}
