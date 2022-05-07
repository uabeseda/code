import { Module } from '@nestjs/common';
import { Transport } from '@nestjs/microservices';
import { IdleClientHandler } from 'domally-utils';
import { configuration } from '../config/configuration';
import { SearchService } from './search.service';

@Module({
  imports: [
    IdleClientHandler.register([{
        name: 'SEARCH_SERVICE',
        transport: Transport.TCP,
        options: {
          host: configuration.search_service.host,
          port: configuration.search_service.port,
        },
      }],
    ),
  ],
  providers: [SearchService],
  exports: [SearchModule, SearchService],
})
export class SearchModule {}
