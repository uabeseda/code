import { ClientProxy } from '@nestjs/microservices';

export type ElasticSqlQueryParams = {
  query?: string;
  filter?: object;
  cursor?: string;
  fetch_size?: number
};


export abstract class ElasticSqlQueryBuilder {
  protected notificationClient: ClientProxy;

  protected constructor(notificationClient) {
    this.notificationClient = notificationClient;
  }

  abstract async buildQuery(query: any, userId?: number);

  abstract async buildFilter(obj: any);
}
