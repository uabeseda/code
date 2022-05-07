import { Module } from '@nestjs/common';
import { UnitService } from './unit.service';
import { UnitController } from './unit.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../entities/user.entity';
import { UnitEntity } from '../entities/unit.entity';
import { StoragesModule } from '../storages/storages.module';
import { EventService } from '../event/event.service';
import { DigitalResourceService } from '../digital-resource/digital-resource.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, UnitEntity]), StoragesModule],
  controllers: [UnitController],
  providers: [UnitService, EventService, DigitalResourceService],
})
export class UnitModule {}
