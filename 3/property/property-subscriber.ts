import { PropertyEntity } from '../entities/property.entity';
import { Connection, EntitySubscriberInterface, EventSubscriber, RemoveEvent, UpdateEvent } from 'typeorm';
import { Types } from 'domally-utils';
import { Inject, Injectable } from '@nestjs/common';
import { SearchService } from '../search/search.service';
import { PropertyHelper } from './property-helper';

@Injectable()
@EventSubscriber()
export class PropertySubscriber implements EntitySubscriberInterface<PropertyEntity> {
  constructor(@Inject(SearchService) private searchService: SearchService, connection: Connection) {
    connection.subscribers.push(this);
  }

  listenTo() {
    return PropertyEntity;
  }

  async afterUpdate(event: UpdateEvent<PropertyEntity>) {
    if (event.entity.status === Types.PropertyStatus.PUBLISHED) {
      const {
        description,
        photos,
        defaultPhoto,
        virtualShowings,
        zoningCode,
        squareDetails,
        rejectReason,
        createdAt,
        updatedAt,
        ...obj
      } = event.entity;
      const dto = PropertyHelper.buildDto(obj);
      await this.searchService.index('property', dto, { ignoreExceptions: true });
    } else {
      await this.searchService.remove('property', { id: event.entity.id }, true);
    }
  }

  afterRemove(event: RemoveEvent<PropertyEntity>) {
    return this.searchService.remove('property', { id: event.entityId }, true);
  }
}
