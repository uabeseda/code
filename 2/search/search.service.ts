import { Inject, Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import {
  SearchDto,
  Types,
  PropertyDto,
  SendPushNotificationsDto,
  NOTIFICATION_TYPE,
} from 'domally-utils';
import { configuration } from '../config/configuration';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { plainToClass } from 'class-transformer';
import * as RequestParams from '@elastic/elasticsearch/api/requestParams';
import { ElasticSqlQueryParams } from './elastic-sql-query-builder';
import { ElasticSqlQueryBuilderProperty } from './elastic-sql-query-builder-property';
import { ElasticSqlQueryBuilderUserFilter } from './elastic-sql-query-builder-user-filter';

@Injectable()
export class SearchService {
  static PROPERTY_INDEX = configuration.elasticsearch_prefix + '_property';
  static USER_FILTER_INDEX = configuration.elasticsearch_prefix + '_user_filter';

  private logger: Logger = new Logger('SearchService');

  constructor(@Inject('NOTIFICATION_SERVICE') private notificationClient: ClientProxy,
              private readonly elasticsearchService: ElasticsearchService) {}

  async indexProperty(req: PropertyDto) {
    try {
      await this.sendNotificationsToUsers(req);
    } catch (e) {
      this.logger.log(`sendNotificationsToUsers error: ${JSON.stringify(e)}`);
    }

    return this.elasticsearchService.index({
      index: SearchService.PROPERTY_INDEX,
      id: '' + req.id,
      body: SearchService.buildPropertyIndexBody(req),
    });
  }

  private static buildPropertyIndexBody(property: PropertyDto) {
    return {
      ...property,
      coords: property?.location?.coords,
      city: property?.location?.city,
      address: property?.location?.address,
    };
  }

  async bulkRebuildProperty(properties: PropertyDto[]) {
    await this.elasticsearchService.indices.delete({ index: SearchService.PROPERTY_INDEX });

    await this.initElastic();

    const bulk = [];

    for (const property of properties) {
      bulk.push({
        index: {
          _index: SearchService.PROPERTY_INDEX,
          _id: property.id,
        },
      });
      bulk.push(SearchService.buildPropertyIndexBody(property));
    }

    return this.elasticsearchService.bulk({
      index: SearchService.PROPERTY_INDEX,
      body: bulk,
    });
  }

  async bulkRebuildSearch(users: {id: number, search: SearchDto}[]) {
    await this.elasticsearchService.indices.delete({ index: SearchService.USER_FILTER_INDEX });

    await this.initElastic();

    const bulk = [];

    for (const user of users) {
      bulk.push({
        index: {
          _index: SearchService.USER_FILTER_INDEX,
          _id: user.id,
        },
      });
      if (user?.search?.filter?.polygon) {
        user.search.filter.polygon.type = 'polygon';
      }
      bulk.push({ userId: user.id, ...user.search.query, ...user.search.filter });
    }

    let r;
    try {
      r = await this.elasticsearchService.bulk({
        index: SearchService.USER_FILTER_INDEX,
        body: bulk,
      });
    } catch (e) {
      console.log(e);
    }
    return r;
  }

  public async indexSearch(searchDto: SearchDto) {
    if (searchDto.skipIndex || (!searchDto || !searchDto.userId || searchDto.searchType !== Types.SearchType.COUNT)) {
      return;
    }

    await this.remove({ index: SearchService.USER_FILTER_INDEX, userId: searchDto.userId });

    const body: any = { userId: searchDto.userId, ...searchDto.query, ...searchDto.filter };

    const params: RequestParams.Index = {
      index: SearchService.USER_FILTER_INDEX,
      id: '' + searchDto.userId,
      body,
    };

    const coords = searchDto?.query?.location?.coords;
    if (!searchDto?.filter?.polygon && coords) {
      body.polygon = {
        type: 'circle',
        radius: configuration.search_params.radius,
        coordinates: [coords.lon, coords.lat],
      };
      params.pipeline = 'polygonize_circles';
    } else if (searchDto?.filter?.polygon) {
      body.polygon.type = 'polygon';
    }

    return this.elasticsearchService.index(params);
  }

  public async searchProperty(searchDto: SearchDto) {
    const { searchType, cursor, query, userId } = searchDto;

    try {
      await this.indexSearch(searchDto);
    } catch (ignored) {
      // console.log(ignored);
// todo: validate polygon
      // return this.elasticsearchService.ml.validate();
    }

    const body: ElasticSqlQueryParams = {};
    if (!cursor) {
      const elasticQueryBuilder = new ElasticSqlQueryBuilderProperty(this.notificationClient);
      const [searchQuery, searchFilter] = await Promise.all([
        elasticQueryBuilder.buildQuery(query, userId),
        elasticQueryBuilder.buildFilter(searchDto),
      ]);
      body.query = searchQuery;
      body.filter = searchFilter;

      if (searchType === Types.SearchType.LIST) {
        body.fetch_size = 20;
      }
    } else {
      body.fetch_size = 20;
      body.cursor = cursor;
    }

    const res = await this.elasticsearchService.sql.query({ body });
    const ids = res?.body?.rows?.flat() ?? [];

    let ranges;
    if (ids?.length > 0 && searchDto.searchType === Types.SearchType.COUNT && searchDto.currency && searchDto.square) {
      const bodyForRange: ElasticSqlQueryParams = {};

      const elasticQueryBuilder = new ElasticSqlQueryBuilderProperty(this.notificationClient);
      const [searchQuery, searchFilter] = await Promise.all([
        elasticQueryBuilder.buildRangeQuery(searchDto, userId),
        elasticQueryBuilder.buildFilter(searchDto),
      ]);
      bodyForRange.query = searchQuery;
      bodyForRange.filter = searchFilter;

      const res = await this.elasticsearchService.sql.query({ body: bodyForRange });
      const [maxSize, minSize, maxPrice, minPrice] = res?.body?.rows && res.body.rows[0];
      ranges = {
        maxSize: maxSize + '',
        minSize: minSize + '',
        maxPrice: maxPrice + '',
        minPrice: minPrice + '',
      };
    }

    return { ids, ranges, cursor: res?.body?.cursor };
  }

  public async remove(req) {
    if (!req.index) {
      return;
    }
    const { index, ...match } = req;
    await this.elasticsearchService.deleteByQuery({
      index,
      body: {
        query: {
          match,
        },
      },
      conflicts: 'proceed',
    });
  }

  public async initElastic() {
    const propertyExists = await this.elasticsearchService.indices.exists({ index: SearchService.PROPERTY_INDEX });
    if (!propertyExists.body) {
      await this.elasticsearchService.indices.create({
        index: SearchService.PROPERTY_INDEX,
        body: {
          "mappings": {
            "properties": {
              "coords": {
                "type": "geo_point"
              },
              "city": {
                "type": "text",
                "fields": {
                  "keyword": {
                    "type": "keyword",
                    "ignore_above": 256
                  }
                }
              },
              "address": {
                "type": "text",
                "fields": {
                  "keyword": {
                    "type": "keyword",
                    "ignore_above": 256
                  }
                }
              },
              "action": {
                "type": "text",
                "fields": {
                  "keyword": {
                    "type": "keyword",
                    "ignore_above": 256
                  }
                }
              },
              "detailedType": {
                "type": "text",
                "fields": {
                  "keyword": {
                    "type": "keyword",
                    "ignore_above": 256
                  }
                }
              },
              "id": {
                "type": "long"
              },
              "commercialData": {
                "properties": {
                  "commercialAdditions": {
                    "properties": {
                      "attic": {
                        "type": "boolean"
                      },
                      "basement": {
                        "type": "boolean"
                      }
                    }
                  },
                  "commercialResidentialUnits": {
                    "type": "long"
                  },
                  "commercialUnits": {
                    "type": "long"
                  },
                  "numberOfCommercialUnits": {
                    "type": "long"
                  },
                  "numberOfSpots": {
                    "type": "long"
                  }
                }
              },
              "residentialData": {
                "properties": {
                  "numberOfSpots": {
                    "type": "long"
                  },
                  "residentialAdditions": {
                    "properties": {
                      "attic": {
                        "type": "boolean"
                      },
                      "basement": {
                        "type": "boolean"
                      },
                      "garage": {
                        "type": "boolean"
                      },
                      "shed": {
                        "type": "boolean"
                      }
                    }
                  },
                  "residentialNumberOfBathrooms": {
                    "type": "long"
                  },
                  "residentialNumberOfBedrooms": {
                    "type": "long"
                  },
                  "residentialNumberOfFloors": {
                    "type": "long"
                  }
                }
              },
              "landData": {
                "type": "object"
              },
              "industrialData": {
                "type": "object"
              },
              "location": {
                "properties": {
                  "address": {
                    "type": "text",
                    "fields": {
                      "keyword": {
                        "type": "keyword",
                        "ignore_above": 256
                      }
                    }
                  },
                  "city": {
                    "type": "text",
                    "fields": {
                      "keyword": {
                        "type": "keyword",
                        "ignore_above": 256
                      }
                    }
                  },
                  "coords": {
                    "type": "geo_point"
                  }
                }
              },
              "price": {
                "properties": {
                  "measure": {
                    "type": "text",
                    "fielddata": true,
                    "fields": {
                      "keyword": {
                        "type": "keyword",
                        "ignore_above": 256
                      }
                    }
                  },
                  "value": {
                    "type": "long"
                  }
                }
              },
              "size": {
                "properties": {
                  "measure": {
                    "type": "text",
                    "fielddata": true,
                    "fields": {
                      "keyword": {
                        "type": "keyword",
                        "ignore_above": 256
                      }
                    }
                  },
                  "value": {
                    "type": "long"
                  }
                }
              },
              "status": {
                "type": "text",
                "fields": {
                  "keyword": {
                    "type": "keyword",
                    "ignore_above": 256
                  }
                }
              },
              "type": {
                "type": "text",
                "fields": {
                  "keyword": {
                    "type": "keyword",
                    "ignore_above": 256
                  }
                }
              },
              "userId": {
                "type": "long"
              },
            }
          },
        },
      });
    }

    const searchExists = await this.elasticsearchService.indices.exists({ index: SearchService.USER_FILTER_INDEX });
    if (!searchExists.body) {
      await this.elasticsearchService.indices.create({
        index: SearchService.USER_FILTER_INDEX,
        body: {
          mappings: {
            properties: {
              userId: {
                type: 'long'
              },
              polygonSearchType: {
                type: 'text',
                fields: {
                  keyword: {
                    type: 'keyword',
                    ignore_above: 256
                  }
                }
              },
              polygon: {
                type: 'geo_shape',
              },
              "action": {
                "type": "text",
                "fields": {
                  "keyword": {
                    "type": "keyword",
                    "ignore_above": 256
                  }
                }
              },
              "type": {
                "type": "text",
                "fields": {
                  "keyword": {
                    "type": "keyword",
                    "ignore_above": 256
                  }
                }
              },
              "detailedType": {
                "type": "text",
                "fields": {
                  "keyword": {
                    "type": "keyword",
                    "ignore_above": 256
                  }
                }
              },
              location: {
                properties: {
                  city: {
                    type: 'text',
                    fields: {
                      keyword: {
                        type: 'keyword',
                        ignore_above: 256
                      }
                    }
                  },
                  coords: {
                    type: 'geo_point',
                  },
                }
              },
              "price": {
                "properties": {
                  "measure": {
                    "type": "text",
                    "fields": {
                      "keyword": {
                        "type": "keyword",
                        "ignore_above": 256
                      }
                    }
                  },
                  "range": {
                    "properties": {
                      "highest": {
                        "type": "long"
                      },
                      "lowest": {
                        "type": "long"
                      }
                    }
                  }
                }
              },
              "size": {
                "properties": {
                  "measure": {
                    "type": "text",
                    "fields": {
                      "keyword": {
                        "type": "keyword",
                        "ignore_above": 256
                      }
                    }
                  },
                  "range": {
                    "properties": {
                      "highest": {
                        "type": "long"
                      },
                      "lowest": {
                        "type": "long"
                      }
                    }
                  }
                }
              },
              "commercialData": {
                "properties": {
                  "commercialUnits": {
                    "type": "text",
                    "fields": {
                      "keyword": {
                        "type": "keyword",
                        "ignore_above": 256
                      }
                    }
                  },
                  "commercialResidentialUnits": {
                    "type": "text",
                    "fields": {
                      "keyword": {
                        "type": "keyword",
                        "ignore_above": 256
                      }
                    }
                  },
                  "numberOfCommercialUnits": {
                    "type": "text",
                    "fields": {
                      "keyword": {
                        "type": "keyword",
                        "ignore_above": 256
                      }
                    }
                  },
                  "numberOfSpots": {
                    "type": "text",
                    "fields": {
                      "keyword": {
                        "type": "keyword",
                        "ignore_above": 256
                      }
                    }
                  },
                  "commercialAdditions": {
                    "properties": {
                      "attic": {
                        "type": "boolean"
                      },
                      "basement": {
                        "type": "boolean"
                      }
                    }
                  },
                }
              },
              "residentialData": {
                "properties": {
                  "residentialNumberOfBedrooms": {
                    "type": "text",
                    "fields": {
                      "keyword": {
                        "type": "keyword",
                        "ignore_above": 256
                      }
                    }
                  },
                  "residentialNumberOfBathrooms": {
                    "type": "text",
                    "fields": {
                      "keyword": {
                        "type": "keyword",
                        "ignore_above": 256
                      }
                    }
                  },
                  "numberOfSpots": {
                    "type": "text",
                    "fields": {
                      "keyword": {
                        "type": "keyword",
                        "ignore_above": 256
                      }
                    }
                  },
                  "residentialNumberOfFloors": {
                    "type": "text",
                    "fields": {
                      "keyword": {
                        "type": "keyword",
                        "ignore_above": 256
                      }
                    }
                  },
                  "residentialAdditions": {
                    "properties": {
                      "attic": {
                        "type": "boolean"
                      },
                      "basement": {
                        "type": "boolean"
                      },
                      "garage": {
                        "type": "boolean"
                      },
                      "shed": {
                        "type": "boolean"
                      }
                    }
                  },
                }
              },
            }
          },
        },
      });
    }

    const pipelines = await this.elasticsearchService.ingest.getPipeline();

    if (!pipelines?.body?.polygonize_circles) {
      await this.elasticsearchService.ingest.putPipeline({
        id: 'polygonize_circles',
        body: {
          description: 'translate circle to polygon',
          processors: [
            {
              circle: {
                field: 'polygon',
                error_distance: 28,
                shape_type: 'geo_shape',
              },
            },
          ],
        },
      });
    }
  }

  private async sendNotificationsToUsers(req: object) {
    const property: PropertyDto = plainToClass(PropertyDto, req, { excludeExtraneousValues: true });

    const body: ElasticSqlQueryParams = {};

    const elasticQueryBuilder = new ElasticSqlQueryBuilderUserFilter(this.notificationClient);

    const [searchQuery, searchFilter] = await Promise.all([
      elasticQueryBuilder.buildQuery(property, property.userId),
      elasticQueryBuilder.buildFilter(property?.location?.coords),
    ]);
    body.query = searchQuery;
    body.filter = searchFilter;

    const res = await this.elasticsearchService.sql.query({ body });
    const userIds: number[] = res?.body?.rows?.flat();

    const data: SendPushNotificationsDto = {
      userIds: [...new Set(userIds)],
      payload: {
        data: { propertyId: `${property.id}`, notificationType: NOTIFICATION_TYPE.NEW_PROPERTY },
        notification: {
          title: 'Domally',
          body: 'New property was added',
          timestamp: new Date().toISOString(),
          sound: 'default',
        }
      }
    };
    await lastValueFrom(this.notificationClient.send(
      { role: 'push-notification', cmd: 'send-bulk' },
      data,
    ));
  }
}
