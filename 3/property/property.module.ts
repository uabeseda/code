import { Module } from '@nestjs/common';
import { PropertyService } from './property.service';
import { PropertyController } from './property.controller';
import { HistoryModule } from '../history/history.module';
import { SearchModule } from '../search/search.module';
import { Transport } from '@nestjs/microservices';
import { configuration } from 'src/config/configuration';
import { IdleClientHandler } from 'domally-utils';
@Module({
  imports: [
    HistoryModule,
    SearchModule,
    IdleClientHandler.register([
      {
        name: 'NOTIFICATION_SERVICE',
        transport: Transport.TCP,
        options: {
          host: configuration.notification_service.host,
          port: configuration.notification_service.port,
        },
      },
    ]),
    IdleClientHandler.register([
      {
        name: 'CHAT_SERVICE',
        transport: Transport.TCP,
        options: {
          host: configuration.chat_service.host,
          port: configuration.chat_service.port,
        },
      },
    ]),
  ],
  controllers: [PropertyController],
  providers: [PropertyService],
})
export class PropertyModule {}
