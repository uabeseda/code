import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UserDto } from '../auth/dto/user.dto';
import { UnitDto } from './dto/unit.dto';
import { UserEntity } from '../entities/user.entity';
import { UnitEntity } from '../entities/unit.entity';
import { ClassEntity } from '../entities/class.entity';
import { ScholarEntity } from '../entities/scholar.entity';
import { AnetaPackType, UnitType, UserType } from '../types';
import { getConnection, In } from 'typeorm';
import { EventEntity } from '../entities/event.entity';
import { OverrideAnetaPackDto } from '../aneta-pack/dto/override-aneta-pack.dto';
import { AnetaPackEntity } from '../entities/aneta-pack.entity';
import { DigitalResourceEntity } from '../entities/digital-resource.entity';
import * as moment from 'moment';
import { UnitToEventEntity } from '../entities/unit-to-event.entity';
import { EventService } from '../event/event.service';
import { MergeAnetaPackDto } from '../aneta-pack/dto/merge-aneta-pack.dto';
import { DigitalResourceService } from '../digital-resource/digital-resource.service';
import { CreateEventRequest } from '../event/dto/create-event.request';
import { AnetaPackStatsResponse } from './dto/aneta-pack-stats.response';
import {
  Loggable,
  UseLoggerInstance,
} from '../service-info/service-info.with-logging.decorator';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
@Loggable()
export class UnitService {
  @InjectPinoLogger(UnitService.name)
  @UseLoggerInstance()
  private readonly logger: PinoLogger;

  constructor(
    private readonly eventService: EventService,
    private readonly digitalResourceService: DigitalResourceService,
  ) {}

  async create(
    createUnitDto: CreateUnitDto,
    userDto: UserDto,
  ): Promise<UnitDto> {
    const userEntity = await UserEntity.findOne(userDto.id);

    const count = userEntity.units.reduce(function (count, unit) {
      if (unit.type === UnitType.SCHOLAR) {
        count++;
      }
      return count;
    }, 0);

    if (userDto.type === UserType.PARENT && count >= 5) {
      throw new BadRequestException({
        message: 'You can not add more than 5 children',
      });
    }

    if (userDto.type === UserType.PARENT && createUnitDto.grades.length > 1) {
      throw new BadRequestException({
        message: 'You can select only one grade for child',
      });
    }

    let unitEntity: UnitEntity | ClassEntity | ScholarEntity;
    if (userDto.type === UserType.TEACHER) {
      unitEntity = ClassEntity.create(createUnitDto);
    } else {
      unitEntity = ScholarEntity.create(createUnitDto);
    }
    await unitEntity.save();

    userEntity.units.push(unitEntity);
    await userEntity.save();

    return new UnitDto(unitEntity);
  }

  async findAll(userDto: UserDto, unitTypes: UnitType[]): Promise<UnitDto[]> {
    const units = await UnitEntity.getUnits({ userId: userDto.id, unitTypes });
    return units.map((u) => new UnitDto(u));
  }

  async findOne(id: number, user: UserDto): Promise<UnitDto> {
    const unitEntity = await UnitEntity.findOne(id, {
      where: {
        user,
      },
    });

    if (!unitEntity) {
      throw new NotFoundException(null, 'Unit not found');
    }

    return new UnitDto(unitEntity);
  }

  async getStat(id: number, user: UserDto): Promise<AnetaPackStatsResponse> {
    const data = await AnetaPackEntity.getRepository()
      .createQueryBuilder('unit')
      .leftJoinAndSelect('unit.user', 'user')
      .andWhere('unit."parentId" = :unitId ', { unitId: id })
      .andWhere('unit."userId" IS NOT NULL')
      .getMany();

    const emails = [];
    let timesApplied = 0;

    for (const anetaPack of data) {
      emails.push(anetaPack.user.email);
      if (anetaPack.isApplied) {
        timesApplied++;
      }
    }

    return { recipients: data.length, timesApplied, emails };
  }

  async update(id: number, updateUnitDto: UpdateUnitDto, userId) {
    const unitEntity: UnitEntity = await UnitEntity.getUnitById(id, userId);
    if (!unitEntity) {
      throw new NotFoundException(null, 'Unit not found');
    }
    if (updateUnitDto.settings && unitEntity.settings) {
      updateUnitDto.settings = {
        ...unitEntity.settings,
        ...updateUnitDto.settings,
      };
    }

    UnitEntity.getRepository().merge(unitEntity, updateUnitDto);
    await unitEntity.save();
    return unitEntity;
  }

  async remove(unitId: number, userId: number) {
    const connection = getConnection();
    const queryRunner = connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const events = await queryRunner.manager
        .getRepository(EventEntity)
        .createQueryBuilder('event')
        .innerJoinAndSelect('event.unitToEventEntities', 'unitToEventEntity')
        .innerJoinAndSelect('unitToEventEntity.unit', 'unit')
        .where('unit.userId = :userId', { userId })
        .andWhere('unit.id = :unitId', { unitId })
        .getMany();

      await queryRunner.manager.getRepository(EventEntity).remove(events);

      await queryRunner.manager.update(
        AnetaPackEntity,
        { parentId: unitId },
        { parentId: null },
      );

      await Promise.all([
        queryRunner.manager.delete(UnitEntity, {
          id: unitId,
          user: { id: userId },
        }),
        queryRunner.manager.delete(UnitEntity, {
          id: unitId,
          createdById: userId,
        }),
      ]);

      await queryRunner.commitTransaction();
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async override(
    id: number,
    overrideAnetaPackDto: OverrideAnetaPackDto,
    user: UserDto,
  ) {
    const anetaPackEntity = await AnetaPackEntity.findOne({
      where: [
        {
          id: overrideAnetaPackDto.anetaPackId,
          user: { id: user.id },
        },
        {
          id: overrideAnetaPackDto.anetaPackId,
          anetaPackType: AnetaPackType.A_A,
        },
      ],
    });
    if (!anetaPackEntity) {
      throw new BadRequestException({
        message: `Aneta pack #${overrideAnetaPackDto.anetaPackId} not found`,
      });
    }

    const unitEntity = await UnitEntity.findOne({ id, user: { id: user.id } });
    if (!unitEntity) {
      throw new BadRequestException({ message: `Unit #${id} not found` });
    }

    const [digitalResources, events] = await Promise.all([
      DigitalResourceEntity.find({
        unit: { id: overrideAnetaPackDto.anetaPackId, user: { id: user.id } },
      }),
      this.eventService.getEvents({
        userId: user.id,
        createdById: null,
        unitId: overrideAnetaPackDto.anetaPackId,
        from: null,
        to: null,
      }),
    ]);

    if (overrideAnetaPackDto.homeroom) {
      await DigitalResourceEntity.delete({ unitId: id });

      // Clone digital resources from aneta pack
      unitEntity.digitalResources = [];
      for (const digitalResource of digitalResources) {
        const clone = Object.assign({}, digitalResource, { id: undefined });
        clone.unitId = id;
        // todo: use bulk insert
        const digitalResourceEntity = DigitalResourceEntity.getRepository().create(
          clone,
        );
        digitalResourceEntity.unit = unitEntity;
        await digitalResourceEntity.save();
        unitEntity.digitalResources.push(digitalResourceEntity);
      }
    }

    if (overrideAnetaPackDto.schedule) {
      const from = moment(
        overrideAnetaPackDto.startTime,
        'YYYY-MM-DD HH:mm',
      ).toISOString();
      const to = moment(overrideAnetaPackDto.startTime, 'YYYY-MM-DD HH:mm')
        .add(overrideAnetaPackDto.repeat * 7, 'days')
        .toISOString();
      const eventsToRemove = await getConnection()
        .getRepository(EventEntity)
        .createQueryBuilder('event')
        .innerJoinAndSelect('event.unitToEventEntities', 'unitToEventEntity')
        .innerJoinAndSelect('unitToEventEntity.unit', 'unit')
        .where('unit.userId = :userId', { userId: user.id })
        .andWhere('unit.id = :unitId', { unitId: unitEntity.id })
        .andWhere('event."startTime" >= :from', { from })
        .andWhere('event."endTime" <= :to', { to })
        .getMany();
      const parentEventsToRemove: EventEntity[] = await getConnection()
        .getRepository(EventEntity)
        .createQueryBuilder('event')
        .innerJoinAndSelect('event.unitToEventEntities', 'unitToEventEntity')
        .innerJoinAndSelect('unitToEventEntity.unit', 'unit')
        .where('unit.userId = :userId', { userId: user.id })
        .andWhere('unit.id = :unitId', { unitId: unitEntity.id })
        .andWhere('event."startTime" >= :from', { from })
        .andWhere('event."endTime" <= :to', { to })
        .andWhere('event.repeat is not null')
        .andWhere('event."parentId" is null')
        .getMany();
      await getConnection().getRepository(EventEntity).remove(eventsToRemove);
      for (const ev of parentEventsToRemove) {
        // await EventEntity.update({ parent: { id: ev.id } }, { parentId: newParentId });
      }

      if (events && Array.isArray(events) && events.length > 0) {
        const a = moment(overrideAnetaPackDto.startTime, 'YYYY-MM-DD HH:mm');
        const b = moment(anetaPackEntity.startTime, 'YYYY-MM-DD HH:mm');
        const shift = a.diff(b, 'days');
        for (let i = 0; i < overrideAnetaPackDto.repeat; i++) {
          for (let j = 0; j < events.length; j++) {
            const event = events[j];
            const clone = Object.assign({}, event, {
              id: undefined,
              parent: undefined,
              repeat: undefined,
            });
            // todo: use bulk insert
            const evnt: EventEntity = EventEntity.getRepository().create(clone);
            evnt.startTime = moment(evnt.startTime, 'YYYY-MM-DD HH:mm')
              .add(shift + i * 7, 'days')
              .toDate();
            evnt.endTime = moment(evnt.endTime, 'YYYY-MM-DD HH:mm')
              .add(shift + i * 7, 'days')
              .toDate();
            evnt.unitToEventEntities = null;
            evnt.unit = unitEntity;
            await evnt.save();

            const unitToEventEntity = new UnitToEventEntity();
            unitToEventEntity.unit = unitEntity;
            unitToEventEntity.event = evnt;
            await unitToEventEntity.save();
          }
        }
      }
    }

    anetaPackEntity.isApplied = true;
    await anetaPackEntity.save();

    await unitEntity.save();
  }

  async merge(id: number, mergeAnetaPackDto: MergeAnetaPackDto, user: UserDto) {
    const unitEntity = await UnitEntity.findOne({
      id,
      user: { id: user.id },
      type: In([UnitType.SCHOLAR, UnitType.CLASS]),
    });
    if (!unitEntity) {
      const unitType =
        user.type === UserType.PARENT ? UnitType.SCHOLAR : UnitType.CLASS;
      throw new BadRequestException({
        message: `${unitType} #${id} not found`,
      });
    }

    await DigitalResourceEntity.delete({ unitId: id });
    await this.digitalResourceService.create(
      id,
      mergeAnetaPackDto.digitalResources,
      user,
    );

    for (const date in mergeAnetaPackDto.schedule) {
      const from = moment(parseInt(date)).format('YYYY-MM-DD HH:mm');
      const to = moment(parseInt(date))
        .add(1, 'day')
        .format('YYYY-MM-DD HH:mm');
      const eventEntities = await this.eventService.getEvents({
        userId: user.id,
        unitId: id,
        from,
        to,
        createdById: null,
      });
      await EventEntity.getRepository().remove(eventEntities);

      const createEventRequests: CreateEventRequest[] =
        mergeAnetaPackDto.schedule[date];

      for (const eventRequest of createEventRequests) {
        const eventObj = Object.assign({}, eventRequest, {
          id: undefined,
          repeat: undefined,
        });
        await this.eventService.create(id, eventObj, user);
      }
    }

    if (mergeAnetaPackDto.anetaPackId) {
      const anetaPackEntity = await AnetaPackEntity.findOne({
        id: mergeAnetaPackDto.anetaPackId,
        user: { id: user.id },
      });
      if (anetaPackEntity) {
        anetaPackEntity.isApplied = true;
        await anetaPackEntity.save();
      }
    }
  }
}
