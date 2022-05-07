import { ElasticSqlQueryBuilder } from './elastic-sql-query-builder';
import { SearchService } from './search.service';
import { NumberConditionData, SearchDto, transformToNumberConditions, Types } from 'domally-utils';
import { lastValueFrom } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import { BadRequestException } from '@nestjs/common';
import { SearchQueryDto } from 'domally-utils/src/dto/search/search-query.dto';
import { configuration } from '../config/configuration';

export class ElasticSqlQueryBuilderProperty extends ElasticSqlQueryBuilder {

  constructor(notificationClient: ClientProxy) {
    super(notificationClient);
  }

  async buildRangeQuery(searchDto: SearchDto, userId?: number) {
    const { query } = searchDto;
    const rates = await lastValueFrom(this.notificationClient.send({ role: 'currency', cmd: 'get-rates' }, {}));
    const ratesSq = {
      sqm: { sqmRate: 1, sqftRate: 0.092903 },
      sqft: { sqmRate: 10.7639, sqftRate: 1 },
    };
    const ratesCur = {
      usd: { usdRate: 1, cadRate: rates['cad-usd'] },
      cad: { usdRate: rates['usd-cad'], cadRate: 1 },
    };

    query.price = null;
    query.size = null;
    const criteria = await this.getCriteria('p', query, userId);
    return `SELECT MAX(size), MIN(size), MAX(price), MIN(price) FROM (SELECT p.id, CASE WHEN size.measure = 'sqm' THEN size.value * ${ratesSq[searchDto.square].sqmRate} WHEN size.measure = 'sqft' THEN size.value * ${ratesSq[searchDto.square].sqftRate} END AS size, CASE WHEN price.measure = 'usd' THEN price.value * ${ratesCur[searchDto.currency].usdRate} WHEN price.measure = 'cad' THEN price.value * ${ratesCur[searchDto.currency].cadRate} END AS price FROM ${SearchService.PROPERTY_INDEX} p WHERE ${criteria})`;
  }

  async buildQuery(query: SearchQueryDto, userId?: number) {
    const criteria = await this.getCriteria('p', query, userId);
    const { lon, lat } = query.location.coords;
    if (lat && lon) {
      return `SELECT id 
              FROM (
                SELECT
                  p.id,
                  ST_Distance(coords, ST_WKTToSQL('POINT (${lon} ${lat})')) distance
                FROM ${SearchService.PROPERTY_INDEX} p
                WHERE ${criteria}
                ORDER BY distance
              )`;
    } else {
      return `SELECT p.id FROM ${SearchService.PROPERTY_INDEX} p WHERE ${criteria}`;
    }
  }

  async buildFilter(searchDto: SearchDto) {
    const { query, filter } = searchDto;
    if (filter?.polygon || query?.location?.coords) {
      const filterQuery = ElasticSqlQueryBuilderProperty.buildFilterQuery(searchDto);
      if (filterQuery) {
        return filterQuery;
      }
    }
    return null;
  }

  private async getCriteria(prefix: string, queryObj: object, userId?: number) {
    let query = ` 1=1 `;

    if (userId) {
      query += ` and p.userId <> ${userId}`;
    }

    if (!queryObj) {
      return query;
    }

    for (const key of Object.keys(queryObj)) {
      const { value, valueType } = this.getValueAndType(queryObj, key);
      if (value === null || value === undefined) {
        continue;
      }

      const conditionTemplate = {
        string: (p, k, v) => ` and ${p}.${k} = '${v.replace(/'/g, '\'\'')}'`,
        number: (p, k, v) => ` and ${p}.${k} = ${v}`,
        boolean: (p, k, v) => {
          return ` and ${p}.${k} = ${v}`;
        },
        array: (p, k, v) => {
          v = v.map((val) => (typeof val === 'string' ? `'${val.replace(/'/g, '\'\'')}'` : `${val}`));
          return v.length !== 0 ? ` and ${p}.${k} in (${v})` : '';
        },
        range: async (p, k, v) =>
          await this.buildRangeCondition(p, k, {
            range: { lowest: v.range.lowest, highest: v.range.highest },
            measure: v.measure,
          }),
        // city: (p, k, v) => this.buildCityCondition(p, k, v),
        [Types.SearchConditionType.NUMBER_CONDITION]: async (p, k, v) => {
          const cond = transformToNumberConditions(v)
          return cond ? await ElasticSqlQueryBuilderProperty.buildNumberCondition(p, k, cond) : ' and 1=1 ';
        },
        object: async (p, k, v) => {
          let condition = '';
          condition = await this.getCriteria(`${p}.${k}`, v);
          return ` and ${condition}`;
        },
      };
      const cond = await conditionTemplate[valueType]?.(prefix, key, value) ?? '';
      query += cond;
    }

    return query;
  }

  private buildCityCondition(p, k, v) {
    const city = `${v.city.replace(/'/g, '\'\'')}`;
    return ` and MATCH(${k}.city, '${city}', 'fuzziness=AUTO')`;
  }

  private getValueAndType(obj, key) {
    const value = obj[key];
    const type = Reflect.getMetadata('search:notification:type', obj, key);
    const valueType = type || ElasticSqlQueryBuilderProperty.getTypeByValue(value);

    return { value, valueType };
  }

  private static getTypeByValue(value) {
    let valueType: string = typeof value;
    if (valueType === 'object') {
      if (Array.isArray(value)) {
        valueType = 'array';
      } else if (
        value?.hasOwnProperty('range') &&
        value?.hasOwnProperty('measure')
      ) {
        valueType = 'range';
      } else if (value?.hasOwnProperty('polygon')) {
        valueType = 'polygon';
      } else if (value?.hasOwnProperty('city')) {
        valueType = 'city';
      } else if (value?.hasOwnProperty('coords')) {
        valueType = 'coords';
      }
    }
    return valueType;
  }

  private async buildRangeCondition(p, k, value: Types.Range) {
    const rates = await lastValueFrom(this.notificationClient.send({ role: 'currency', cmd: 'get-rates' }, {}));
    const convertedRange: Types.Range = {
      usd: (l, h) => {
        const rate = rates['usd-cad'];
        return {
          range: { lowest: Math.floor(l * rate), highest: Math.ceil(h * rate) },
          measure: Types.MeasureCurrency.CAD,
        };
      },
      cad: (l, h) => {
        const rate = rates['cad-usd'];
        return {
          range: { lowest: Math.floor(l * rate), highest: Math.ceil(h * rate) },
          measure: Types.MeasureCurrency.USD,
        };
      },
      sqm: (l, h) => {
        const rate = 10.7639;
        const lowest = Math.round(l * rate);
        const highest = Math.round(h * rate);
        return {
          range: { lowest, highest },
          measure: Types.MeasureSquare.SQFT,
        };
      },
      sqft: (l, h) => {
        const rate = 0.092903;
        const lowest = Math.round(l * rate);
        const highest = Math.round(h * rate);
        return {
          range: { lowest, highest },
          measure: Types.MeasureSquare.SQM,
        };
      },
    }[value.measure](value.range.lowest, value.range.highest);

    // eslint-disable-next-line max-len
    const originalCondition = `${p}.${k}.value between ${value.range.lowest} and ${value.range.highest} and ${p}.${k}.measure = '${value.measure}'`;
    let convertedCondition = ' 1=1 ';
    if (convertedRange) {
      // eslint-disable-next-line max-len
      convertedCondition = `${p}.${k}.value between ${convertedRange.range.lowest} and ${convertedRange.range.highest} and ${p}.${k}.measure = '${convertedRange.measure}'`;
    }

    return ` and (${originalCondition} or ${convertedCondition}) `;
  }

  private static async buildNumberCondition(p, k, v: NumberConditionData) {
    return ` and ${p}.${k} ${v.op} ${v.value}`;
  }

  private static buildFilterQuery(searchDto: SearchDto) {
    const filter: { geo_polygon?: object, geo_distance?: object } = {};
    if ((searchDto.searchType === Types.SearchType.MAP && searchDto?.filter?.polygon?.coordinates)
      || (searchDto.searchType !== Types.SearchType.MAP && searchDto?.filter?.polygon?.coordinates && searchDto?.filter?.polygonSearchType === Types.PolygonSearchType.CUSTOM)
    ) {
      const points = Array.isArray(searchDto.filter.polygon.coordinates) ? searchDto.filter.polygon.coordinates[0] : searchDto.filter.polygon.coordinates;
      filter.geo_polygon = {
        coords: { points },
      };
    } else if (searchDto?.query?.location?.coords) {
      filter.geo_distance = {
        distance: configuration.search_params.radius,
        coords: searchDto.query.location.coords,
      }
    } else {
      throw new BadRequestException('Set polygon or location');
    }

    return filter;
  }
}
