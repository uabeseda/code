import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { ElasticsearchModule } from "@nestjs/elasticsearch";
import { configuration } from '../config/configuration';
import { Transport } from '@nestjs/microservices';
import { IdleClientHandler } from 'domally-utils';
@Module({
  imports: [
    ElasticsearchModule.register({
      node: configuration.elasticsearch_node,
      auth: {
        apiKey: configuration.elasticsearch_api_key,
      },
    }),
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
  ],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
