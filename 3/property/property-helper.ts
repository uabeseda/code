import { CommercialData, IndustrialData, LandData, PropertyDto, ResidentialData } from 'domally-utils';
import { ResidentialPropertyEntity } from '../entities/residential-property.entity';
import { CommercialPropertyEntity } from '../entities/commercial-property.entity';
import { IndustrialPropertyEntity } from '../entities/industrial-property.entity';
import { LandPropertyEntity } from '../entities/land-property.entity';
import { BadRequestException } from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { PropertyEntity } from '../entities/property.entity';

export class PropertyHelper {
  static createEntity<T extends PropertyEntity>(data: PropertyDto): T {
    let entity;
    switch (data.type) {
      case 'Residential':
        entity = ResidentialPropertyEntity.create({
          ...data,
          ...data.residentialData,
        });
        break;
      case 'Commercial':
        entity = CommercialPropertyEntity.create({
          ...data,
          ...data.commercialData,
        });
        break;
      case 'Industrial':
        entity = IndustrialPropertyEntity.create({
          ...data,
          ...data.industrialData,
        });
        break;
      case 'Land':
        entity = LandPropertyEntity.create({
          ...data,
          ...data.landData,
        });
        break;
      default:
        throw new BadRequestException('Unknown property type');
    }

    return entity;
  }

  static buildDtos(array: object[]): PropertyDto[] {
    if (!Array.isArray(array)) {
      return null;
    }
    return array.map(p => {
      return PropertyHelper.buildDto(p);
    });
  }

  static buildDto(obj): PropertyDto {
    if (!obj) {
      return null;
    }
    const property: PropertyDto = plainToClass(PropertyDto, obj, {
      excludeExtraneousValues: true,
    });

    if (Array.isArray(obj.propertyUserLikes) && obj.propertyUserLikes.length === 1) {
      property.hasLike = true;
    }

    switch (obj.type) {
      case 'Residential':
        property.residentialData = plainToClass(ResidentialData, obj, {
          excludeExtraneousValues: true,
        });
        break;
      case 'Commercial':
        property.commercialData = plainToClass(CommercialData, obj, {
          excludeExtraneousValues: true,
        });
        break;
      case 'Industrial':
        property.industrialData = plainToClass(IndustrialData, obj, {
          excludeExtraneousValues: true,
        });
        break;
      case 'Land':
        property.landData = plainToClass(LandData, obj, {
          excludeExtraneousValues: true,
        });
        break;
      default:
        throw new BadRequestException('Unknown property type');
    }
    return property;
  }
}
