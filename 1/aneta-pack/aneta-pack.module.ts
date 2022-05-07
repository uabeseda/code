import { Module } from '@nestjs/common';
import { AnetaPackService } from './aneta-pack.service';
import { AnetaPackController } from './aneta-pack.controller';
import { UserService } from '../user/user.service';
import { EventService } from '../event/event.service';

@Module({
  controllers: [AnetaPackController],
  providers: [AnetaPackService, UserService, EventService],
})
export class AnetaPackModule {}
