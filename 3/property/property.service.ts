import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClaimRequestDto,
  CLAIM_STATUS,
  GetAllClaimsDto,
  GetAllPropertyDto,
  LikePropertyDto,
  NOTIFICATION_TYPE,
  PropertyDto,
  PropertyUserClaimDto,
  RemovePropertyDto,
  SearchDto,
  SendPushNotificationDto,
  Types,
  UpdatePropertyDto,
} from 'domally-utils';
import { PropertyEntity } from '../entities/property.entity';
import { isEmpty, validate, validateOrReject } from 'class-validator';
import { ResponseFindAllPropertyDto } from './dto';
import { CreateHistoryDto } from '../history/dto/CreateHistoryDto';
import { PropertyUserLikeEntity } from '../entities/property-user-like.entity';
import { PropertyHistoryEntity } from '../entities/property-history.entity';
import { SearchService } from '../search/search.service';
import { PropertyHelper } from './property-helper';
import { PropertyUserClaimEntity } from 'src/entities/property-user-claim.entity';
import { ClientProxy } from '@nestjs/microservices';
import { getConnection } from 'typeorm';

@Injectable()
export class PropertyService {
  constructor(
    @Inject(SearchService) private readonly searchService: SearchService,
    @Inject('NOTIFICATION_SERVICE') private notificationClient: ClientProxy,
    @Inject('CHAT_SERVICE') private chatClient: ClientProxy,
  ) {}

  async create(data: PropertyDto) {
    if (isEmpty(data.type)) {
      throw new BadRequestException('Property type is undefined');
    }

    const propertyEntity = PropertyHelper.createEntity(data);
    return propertyEntity.save();
  }

  async createTest(data: PropertyDto) {
    const property = PropertyHelper.createEntity(data);

    const validationErrors = await validate(PropertyHelper.buildDto(property));
    if (
      validationErrors?.length === 1 &&
      validationErrors[0].property === 'id'
    ) {
      await property.save();
      await this.searchService.index(
        'property',
        { ...PropertyHelper.buildDto(property) },
        { ignoreExceptions: true },
      );
      return property;
    } else {
      return validationErrors;
    }
  }

  async update(
    data: UpdatePropertyDto,
    options?: {
      admin: boolean;
      userId?: number;
      adminId?: number;
      description?: string;
    },
  ) {
    const dataKeys = [
      'residentialData',
      'commercialData',
      'industrialData',
      'landData',
    ];
    for (const dataKey of dataKeys) {
      if (data[dataKey]) {
        data = {
          ...data,
          ...data[dataKey],
        };
        delete data[dataKey];
      }
    }
    let propertyHistory: CreateHistoryDto = {};

    const property = await PropertyEntity.findOne({
      id: data.id,
      userId: data.userId,
    });

    if (!property) {
      throw new BadRequestException('Property not found');
    }

    if (data.status && data.status !== property.status) {
      propertyHistory.status = data.status;
    }

    if (options?.admin) {
      const adminPossibleStatuses = [
        Types.PropertyStatus.REJECTED,
        Types.PropertyStatus.INVISIBLE,
        Types.PropertyStatus.PUBLISHED,
      ];
      if (!adminPossibleStatuses.includes(data.status)) {
        throw new BadRequestException(
          `You can not set status of property to: ${data.status}`,
        );
      }

      if (
        data.status === Types.PropertyStatus.INVISIBLE &&
        property.status !== Types.PropertyStatus.PENDING
      ) {
        throw new BadRequestException(
          `You can not confirm property if it's not in Ready status`,
        );
      }

      await PropertyEntity.merge(property, {
        status: data.status,
        rejectReason: data.rejectReason,
      }).save();

      if (data.status === Types.PropertyStatus.PUBLISHED) {
        await this.propertyPublishedPush(property.userId, property.id);
      }
    } else {
      if (data.status === Types.PropertyStatus.NOT_COMPLETED || !data.status) {
        PropertyEntity.merge(property, data);

        const validationErrors = await validate(
          PropertyHelper.buildDto(property),
        );
        if (validationErrors.length === 0) {
          PropertyEntity.merge(property, {
            status: Types.PropertyStatus.NOT_PUBLISHED,
          });
        } else {
          PropertyEntity.merge(property, {
            status: Types.PropertyStatus.NOT_COMPLETED,
          });
        }

        await property.save();
      } else if (data.status === Types.PropertyStatus.PENDING) {
        try {
          PropertyEntity.merge(property, data);

          await validateOrReject(PropertyHelper.buildDto(property), {
            validationError: {
              target: false,
              value: false,
            },
            dismissDefaultMessages: true,
          });

          await property.save();
        } catch (e) {
          throw new BadRequestException(e);
        }
      } else if (
        [
          Types.PropertyStatus.PUBLISHED,
          Types.PropertyStatus.ARCHIVED,
        ].includes(data.status)
      ) {
        if (
          data.status === Types.PropertyStatus.PUBLISHED &&
          property.status !== Types.PropertyStatus.INVISIBLE &&
          property.status !== Types.PropertyStatus.ARCHIVED
        ) {
          throw new BadRequestException(
            `You can not set status of property to: ${data.status}`,
          );
        }
        await PropertyEntity.merge(property, { status: data.status }).save();
      } else if (
        data.status === Types.PropertyStatus.INVISIBLE &&
        property.status === Types.PropertyStatus.PUBLISHED
      ) {
        await PropertyEntity.merge(property, { status: data.status }).save();
      } else {
        throw new BadRequestException(
          `You can not set status of property to: ${data.status}`,
        );
      }
    }

    if (propertyHistory.status) {
      propertyHistory.property = property;
      propertyHistory.description = options.description;

      if (options.admin) {
        propertyHistory.adminId = options.adminId;
      } else {
        propertyHistory.userId = options.userId;
      }

      await PropertyHistoryEntity.create(propertyHistory).save();
    }

    return PropertyHelper.buildDto(property);
  }

  async findAll(req: GetAllPropertyDto): Promise<ResponseFindAllPropertyDto> {
    const { page, limit, status, userId, createdAt } = req;

    const qb = PropertyEntity.createQueryBuilder('property').orderBy(
      'property.createdAt',
      createdAt,
    );

    if (status) {
      qb.where('property.status = :status', { status });
    }

    if (userId) {
      qb.andWhere('property.userId = :userId', { userId });
    }

    if (page) qb.skip((page - 1) * limit);

    const propertiesResponse = await qb.take(limit).getManyAndCount();
    const pageCount = Math.ceil(propertiesResponse[1] / limit);

    const properties = PropertyHelper.buildDtos(propertiesResponse[0]);
    return {
      properties,
      page,
      pageCount,
      limit,
    };
  }

  async getFavourites(
    req: GetAllPropertyDto,
  ): Promise<ResponseFindAllPropertyDto> {
    const { page, limit, userId } = req;

    const repository = PropertyUserLikeEntity.getRepository();
    const propertiesResponse = await repository.findAndCount({
      where: { userId: userId },
      relations: ['property'],
      skip: (page - 1) * limit,
      take: limit,
    });

    const pageCount = Math.ceil(propertiesResponse[1] / limit);
    const properties = propertiesResponse[0].map((p) =>
      PropertyHelper.buildDto(p.property),
    );

    return {
      properties,
      page,
      pageCount,
      limit,
    };
  }

  async findOne(req: { id: number; userId?: number }) {
    const queryBuilder = PropertyEntity.createQueryBuilder('property')
      .leftJoinAndSelect('property.history', 'history')
      .where('property.id = :id', { id: req.id });

    if (req.userId) {
      queryBuilder.andWhere(`(property.userId = :userId OR property.status = '${Types.PropertyStatus.PUBLISHED}')`, { userId: req.userId });
      queryBuilder.leftJoinAndSelect(
        'property.propertyUserLikes',
        'propertyUserLikes',
        'propertyUserLikes.userId = :userId',
        { userId: req.userId },
      );
    } else {
      queryBuilder.andWhere(`property.status = '${Types.PropertyStatus.PUBLISHED}'`);
    }

    const property = await queryBuilder.getOneOrFail();
    return PropertyHelper.buildDto(property);
  }

  async getPropertiesByIds({ ids }: { ids: number[] }) {
    const queryBuilder = PropertyEntity.createQueryBuilder(
      'property',
    ).where('property.id IN (:...ids)', { ids });

    return queryBuilder.execute();
  }

  async search(searchDto: SearchDto) {
    let { ids, ranges, cursor } = await this.searchService.search('property', {
      ...searchDto,
    });

    let properties;
    switch (searchDto.searchType) {
      case Types.SearchType.COUNT:
        return {
          ranges,
          count: ids?.length ?? 0
        };
      case Types.SearchType.MAP:
        properties = await PropertyService.getPropertiesByIds(
          ids,
          searchDto.userId,
        );
        return { properties: PropertyHelper.buildDtos(properties) };
      case Types.SearchType.LIST:
        properties = await PropertyService.getPropertiesByIds(
          ids,
          searchDto.userId,
        );
        return {
          properties: PropertyHelper.buildDtos(properties),
          cursor,
        };
      default:
        return [];
    }
  }

  async searchByLocation({ ids, query }: { ids: number[]; query: string }) {
    return PropertyEntity.createQueryBuilder('property')
      .where(
        `"property"."id" IN (:...ids) AND (location::jsonb->>'city' ILIKE :name OR location::jsonb->>'address' ILIKE :name)`,
        { ids: ids, name: `%${query}%` },
      )
      .getMany();
  }

  private static async getPropertiesByIds(ids: number[], userId: number) {
    if (!ids || ids.length === 0) {
      return null;
    }

    const queryBuilder = PropertyEntity.createQueryBuilder('property')
      .leftJoinAndSelect('property.history', 'history')
      .where('property.id IN (:...ids)', { ids });

    if (userId) {
      queryBuilder.leftJoinAndSelect(
        'property.propertyUserLikes',
        'propertyUserLikes',
        'propertyUserLikes.userId = :userId',
        { userId },
      );
    }

    return await queryBuilder.getMany();
  }

  async remove(removeRequest: RemovePropertyDto) {
    const properties = await PropertyEntity.find({
      where: removeRequest,
    });
    const res = await PropertyEntity.remove(properties);

    await this.chatClient
      .send(
        { role: 'chat', cmd: 'delete' },
        {
          userId: removeRequest?.userId,
          propertyId: removeRequest?.id,
        },
      )
      .toPromise();

    if (removeRequest?.userId) {
      await PropertyUserClaimEntity.delete({ userId: removeRequest.userId });
    }

    return res;
  }

  like(request: LikePropertyDto) {
    const propertyUserLike = new PropertyUserLikeEntity();
    propertyUserLike.propertyId = request.id;
    propertyUserLike.userId = request.userId;

    return propertyUserLike.save();
  }

  unlike(request: LikePropertyDto) {
    return PropertyUserLikeEntity.createQueryBuilder('property_user_like')
      .delete()
      .from(PropertyUserLikeEntity)
      .where('propertyId = :id AND userId = :userId', { ...request })
      .execute();
  }

  async addPropertyClaim(data: PropertyUserClaimDto) {
    const message =
      'Your complaint has been received and is pending administrator review.';
    const property = await PropertyEntity.findOne(data.propertyId);

    if(!property) {
      throw new NotFoundException('There is no such property!');
    }

    const propertyUserClaim = PropertyUserClaimEntity.create({
      ...data,
      property,
    });

    await this.propertyClaimPush(
      data.userId,
      data.propertyId,
      message,
      CLAIM_STATUS.CREATED,
    );

    return propertyUserClaim.save();
  }

  async getPropertyClaims(data: GetAllClaimsDto) {
    const { createdAt, page, limit } = data;

    const qb = PropertyUserClaimEntity.createQueryBuilder('claims').orderBy(
      'claims.createdAt',
      createdAt,
    );

    const claimsResponse = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    const pageCount = Math.ceil(claimsResponse[1] / limit);

    return {
      data: claimsResponse[0],
      page,
      pageCount,
      limit,
    };
  }

  async getPropertyClaim(id: number): Promise<PropertyUserClaimDto> {
    const claim = await PropertyUserClaimEntity.findOne(id);
    if (!claim) {
      throw new BadRequestException('Can not find claim!');
    }
    return claim;
  }

  deleteClaim(removeRequest: RemovePropertyDto) {
    return PropertyUserClaimEntity.delete(removeRequest);
  }

  async approveClaim({
    userId,
    propertyId,
    propertyUserId,
  }: ClaimRequestDto): Promise<void> {
    const removeRequest = { id: propertyId, userId: propertyUserId };
    const userMessage =
      'Your complaint has been resolved by the administrator.';
    const propertyUserMessage =
      'We have received a complaint on your property, your property was deleted according to our application policy.';

    await this.remove(removeRequest);
    await this.propertyClaimPush(
      userId,
      propertyId,
      userMessage,
      CLAIM_STATUS.APPROVED,
    );
    await this.propertyClaimPush(
      propertyUserId,
      propertyId,
      propertyUserMessage,
      CLAIM_STATUS.APPROVED,
    );
  }

  async rejectClaim({ id, userId, propertyId }: ClaimRequestDto) {
    const userMessage =
      'Your complaint has been declined by the administrator.';
    await this.deleteClaim({ id, userId });
    await this.propertyClaimPush(
      userId,
      propertyId,
      userMessage,
      CLAIM_STATUS.DECLINED,
    );
  }

  propertyClaimPush(userId: number, propertyId: number, body: string, status: string) {
    const payload: SendPushNotificationDto = {
      userId,
      payload: {
        data: {
          notificationType: NOTIFICATION_TYPE.PROPERTY_CLAIM,
          propertyId: propertyId?.toString(),
          status,
        },
        notification: {
          title: 'Message form the admin',
          body,
          timestamp: new Date().toISOString(),
        },
      },
    };
    return this.notificationClient
      .send({ role: 'push-notification', cmd: 'send' }, payload)
      .toPromise();
  }

  propertyPublishedPush(userId: number, propertyId: number) {
    const payload: SendPushNotificationDto = {
      userId,
      payload: {
        data: {
          notificationType: NOTIFICATION_TYPE.PROPERTY_PUBLISHED,
          propertyId: propertyId?.toString(),
          status: Types.PropertyStatus.PUBLISHED,
        },
        notification: {
          title: 'Domally',
          body: 'Your property has been published',
          timestamp: new Date().toISOString(),
        },
      },
    };
    return this.notificationClient.send({ role: 'push-notification', cmd: 'send' }, payload).toPromise();
  }

  async rebuildIndex() {
    const properties = await getConnection().createQueryBuilder(PropertyEntity, 'property')
      .select('property.id')
      .addSelect('property.userId')
      .addSelect('property.action')
      .addSelect('property.status')
      .addSelect('property.type')
      .addSelect('property.detailedType')
      .addSelect('property.location')
      .addSelect('property.size')
      .addSelect('property.price')
      .addSelect('property.residentialNumberOfBedrooms')
      .addSelect('property.residentialNumberOfBathrooms')
      .addSelect('property.numberOfSpots')
      .addSelect('property.residentialNumberOfFloors')
      .addSelect('property.residentialAdditions')
      .addSelect('property.commercialUnits')
      .addSelect('property.commercialResidentialUnits')
      .addSelect('property.numberOfCommercialUnits')
      .addSelect('property.numberOfSpots')
      .addSelect('property.commercialAdditions')
      .where('status = :status', { status: Types.PropertyStatus.PUBLISHED })
      .getMany();

    await this.searchService.index(
      'property',
      PropertyHelper.buildDtos(properties),
      { ignoreExceptions: true, cmd: 'bulk-rebuild' },
    );
  }
}
