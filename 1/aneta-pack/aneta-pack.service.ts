import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateAnetaPackDto } from './dto/create-aneta-pack.dto';
import { UpdateAnetaPackDto } from './dto/update-aneta-pack.dto';
import { UserDto } from '../auth/dto/user.dto';
import { AnetaPackEntity } from '../entities/aneta-pack.entity';
import { UnitEntity } from '../entities/unit.entity';
import { DigitalResourceEntity } from '../entities/digital-resource.entity';
import { UserService } from '../user/user.service';
import { AnetaPackType, UnitType, UserType } from '../types';
import { EventService } from '../event/event.service';
import * as moment from 'moment';
import { EventEntity } from '../entities/event.entity';
import { UnitToEventEntity } from '../entities/unit-to-event.entity';
import { ShareAnetaPackDto } from './dto/share-aneta-pack.dto';
import { EventDto } from '../event/dto/event.dto';
import {
  Loggable,
  UseLoggerInstance,
} from '../service-info/service-info.with-logging.decorator';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
@Loggable()
export class AnetaPackService {
  @InjectPinoLogger(AnetaPackService.name)
  @UseLoggerInstance()
  private readonly logger: PinoLogger;

  constructor(
    private readonly userService: UserService,
    private readonly eventService: EventService,
  ) {}

  async create(
    createAnetaPackDto: CreateAnetaPackDto,
    user: UserDto,
  ): Promise<AnetaPackEntity> {
    if (!createAnetaPackDto.startTime) {
      throw new BadRequestException({ message: 'Start time is undefined' });
    }
    const unitId = createAnetaPackDto.unitId;

    const unit = await UnitEntity.findOne({
      id: unitId,
      user: { id: user.id },
    });
    if (!unit) {
      throw new BadRequestException({ message: `Unit #${unitId} not found` });
    }

    const anetaPackEntity = await this._createAnetaPackFromUnit({
      unit,
      createdBy: user,
      startTime: createAnetaPackDto.startTime,
      assignTo: null,
    });

    // Share aneta pack
    if (
      user.type !== UserType.ANETA_TEACHER &&
      createAnetaPackDto.emails &&
      Array.isArray(createAnetaPackDto.emails)
    ) {
      await this._shareAnetaPack({
        id: anetaPackEntity.id,
        emails: createAnetaPackDto.emails,
        user,
      });
    }

    return anetaPackEntity;
  }

  async share(id: number, shareAnetaPackDto: ShareAnetaPackDto, user: UserDto) {
    if (shareAnetaPackDto.emails && Array.isArray(shareAnetaPackDto.emails)) {
      await this._shareAnetaPack({
        id,
        emails: shareAnetaPackDto.emails,
        user,
      });
    }
  }

  async findAll({ userId, name, curator, grade, skill, interest }) {
    const query = AnetaPackEntity.getRepository()
      .createQueryBuilder('anetaPack')
      .leftJoin('anetaPack.createdBy', 'user')
      .leftJoin('user.profile', 'profile')
      .where('"anetaPack"."userId" = :userId', { userId });

    if (name) {
      const filter = '%' + name + '%';
      query.andWhere(`"anetaPack".name LIKE(:filter)`, { filter });
    }
    if (grade) {
      query.andWhere('"anetaPack".grades && :grade', { grade });
    }
    if (curator) {
      query.andWhere('profile.type IN (:...curator)', { curator });
    }
    if (skill) {
      query.andWhere('"anetaPack".skills && :skill', { skill });
    }
    if (interest) {
      query.andWhere('"anetaPack".interests && :interest', { interest });
    }

    if (!curator || curator.includes(UserType.ANETA_TEACHER)) {
      let orCondition = `"anetaPack"."anetaPackType" = '${AnetaPackType.A_A}'`;
      let params = {};
      if (skill) {
        orCondition += ' and "anetaPack".skills && :skill';
        params = { ...params, ...skill };
      }
      if (grade) {
        orCondition += ' and "anetaPack".grades && :grade';
        params = { ...params, ...grade };
      }
      if (curator) {
        orCondition += ' and profile.type IN (:...curator)';
        params = { ...params, ...curator };
      }
      if (interest) {
        orCondition += ' and "anetaPack".interests && :interest';
        params = { ...params, ...interest };
      }
      query.orWhere(orCondition, params);
    }

    return query.getMany();
  }

  async findOne(id: number, user: UserDto) {
    const [anetaPack, digitalResources, events] = await Promise.all([
      AnetaPackEntity.findOne(id),
      DigitalResourceEntity.find({ unit: { id, user: { id: user.id } } }),
      this.eventService.findAll({
        userId: user.id,
        createdById: null,
        unitId: id,
        from: null,
        to: null,
      }),
    ]);

    const eventsMap = await AnetaPackService._groupByDay(
      anetaPack.startTime,
      events,
    );

    return { anetaPack, digitalResources, events: eventsMap };
  }

  async update(id: number, updateAnetaPackDto: UpdateAnetaPackDto) {
    throw new Error('Need to implement');
  }

  async remove(id: number) {
    throw new Error('Need to implement');
  }

  private async _shareAnetaPack({ id, emails, user }) {
    const anetaPackEntity = await AnetaPackEntity.findOne({
      id,
      createdById: user.id,
    });
    if (!anetaPackEntity) {
      throw new BadRequestException({ message: `Aneta pack #${id} not found` });
    }

    for (const email of emails) {
      const assignTo = await this.userService.getByEmailOrPreCreateUser(email);

      await this._createAnetaPackFromUnit({
        unit: anetaPackEntity,
        createdBy: user,
        startTime: anetaPackEntity.startTime,
        assignTo,
      });
    }
  }

  private async _createAnetaPackFromUnit({
    unit,
    startTime,
    createdBy,
    assignTo,
  }): Promise<AnetaPackEntity> {
    // todo: wrap aneta-pack creation into transaction
    const unitId = unit.id;

    startTime = moment(startTime, 'YYYY-MM-DD HH:mm')
      .set('minute', 0)
      .set('second', 0)
      .format('YYYY-MM-DD HH:mm');
    const to = moment(startTime, 'YYYY-MM-DD HH:mm')
      .add(1, 'week')
      .format('YYYY-MM-DD HH:mm');
    let userId: number;
    if (assignTo && !createdBy) {
      userId = assignTo.id;
    } else if (createdBy && !assignTo) {
      userId = createdBy.id;
    }
    const [digitalResources, events] = await Promise.all([
      DigitalResourceEntity.find({
        unit: { id: unitId, user: { id: createdBy.id } },
      }),
      this.eventService.getEvents({
        userId,
        createdById: createdBy.id,
        unitId,
        from: startTime,
        to,
      }),
    ]);

    // Clone aneta pack from unit
    const apQuery = AnetaPackEntity.getRepository().createQueryBuilder('unit');
    if (assignTo) {
      apQuery.where('unit.parentId = :unitId AND unit.userId = :userId', {
        unitId: unit.parentId,
        userId: assignTo.id,
      });
    } else {
      apQuery.where('unit.parentId = :unitId ', { unitId });
    }

    let anetaPackEntity: AnetaPackEntity = await apQuery.getOne();

    if (anetaPackEntity) {
      await anetaPackEntity.remove();
    }

    anetaPackEntity = AnetaPackEntity.getRepository().create();

    const clone = Object.assign({}, unit, {
      id: undefined,
      settings: undefined,
      userId: undefined,
    });
    anetaPackEntity = AnetaPackEntity.getRepository().merge(
      anetaPackEntity,
      clone,
    );

    anetaPackEntity.startTime = moment(startTime, 'YYYY-MM-DD HH:mm').toDate();

    if (unit.type !== UnitType.ANETA_PACK) {
      anetaPackEntity.parentId = unitId;
    }

    if (createdBy) {
      anetaPackEntity.createdById = createdBy.id;
      if (createdBy.type === UserType.ANETA_TEACHER) {
        anetaPackEntity.anetaPackType = AnetaPackType.A_A;
      } else {
        anetaPackEntity.anetaPackType = AnetaPackType.SHARED;
      }
    }
    if (assignTo) {
      anetaPackEntity.userId = assignTo.id;
    }
    await anetaPackEntity.save();

    // Clone digital resources for new aneta pack
    anetaPackEntity.digitalResources = [];
    for (const digitalResource of digitalResources) {
      const clone = Object.assign({}, digitalResource, { id: undefined });
      clone.unitId = anetaPackEntity.id;
      anetaPackEntity.digitalResources.push(
        DigitalResourceEntity.getRepository().create(clone),
      );
    }

    // Clone events for new aneta pack
    for (const event of events) {
      const clone = Object.assign({}, event, { id: undefined });
      const evnt: EventEntity = EventEntity.getRepository().create(clone);
      evnt.parent = null;
      evnt.repeat = null;
      evnt.unitToEventEntities = null;
      await evnt.save();

      const unitToEventEntity = new UnitToEventEntity();
      unitToEventEntity.unit = anetaPackEntity;
      unitToEventEntity.event = evnt;
      await unitToEventEntity.save();
    }

    await anetaPackEntity.save();

    return anetaPackEntity;
  }

  private static async _groupByDay(startTime: Date, events: EventDto[]) {
    const dateMap = {};

    for (let i = 0; i < 7; i++) {
      const key = moment(startTime).add(i, 'day').toDate().getTime();
      dateMap[key] = [];
    }

    for (const event of events) {
      const eventTime = moment(event.startTime);

      for (const key in dateMap) {
        if (
          eventTime.isSameOrAfter(moment(parseInt(key))) &&
          eventTime.diff(moment(parseInt(key)), 'days') === 0
        ) {
          dateMap[key].push(event);
          break;
        }
      }
    }

    return dateMap;
  }
}
