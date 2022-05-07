import { ElasticSqlQueryBuilder } from './elastic-sql-query-builder';
import { PropertyDto, Types } from 'domally-utils';
import { SearchService } from './search.service';
import { lastValueFrom } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';

export class ElasticSqlQueryBuilderUserFilter extends ElasticSqlQueryBuilder {

  constructor(notificationClient: ClientProxy) {
    super(notificationClient);
  }

  async buildQuery(property: PropertyDto, userId?: number) {
    const criteria = await this.getCriteria('s', property, userId);
    return `select s.userId from ${SearchService.USER_FILTER_INDEX} s where ${criteria}`;
  }

  async buildFilter(coords: Types.Coords) {
    return coords ? {
      geo_shape: {
        polygon: {
          shape: {
            type: 'point',
            coordinates: [coords.lon, coords.lat],
          },
          relation: 'intersects',
        },
      },
    } : null;
  }

  private async getCriteria(prefix, queryObj: object, userId?: number) {
    let query = ` 1=1 `;

    if (userId) {
      query += ` and s.userId <> ${userId}`;
    }

    if (!queryObj) {
      return query;
    }

    for (const key of Object.keys(queryObj)) {
      const value = queryObj[key];

      const exclude = Reflect.getMetadata('search:notification:exclude', queryObj, key);

      if (value === null || value === undefined || exclude === true) {
        continue;
      }

      const type = Reflect.getMetadata('search:notification:type', queryObj, key);
      const valueType: string = type || typeof value;

      const conditionTemplate = {
        string: (p, k, v) => ` and (${p}.${k} = '${v.replace(/'/g, '\'\'')}' OR ${p}.${k} IS NULL)`,
        number: (p, k, v) => ` and (${p}.${k} = ${v} OR ${p}.${k} IS NULL)`,
        boolean: (p, k, v) => {
          return ` and (${p}.${k} = ${v} OR ${p}.${k} IS NULL)`;
        },
        array: (p, k, v) => {
          return ` and (${p}.${k} = '${v}' OR ${p}.${k} IS NULL)`;
        },
        range: async (p, k, v) =>
          await this.buildRangeCondition(p, k, v),
        // city: (p, k, v) => this.buildCityCondition(p, k, v),
        object: async (p, k, v) => {
          const condition = await this.getCriteria(`${p}.${k}`, v);
          return ` and (${condition} OR ${p}.${k} IS NULL)`;
        },
      };
      const cond = await conditionTemplate[valueType]?.(prefix, key, value) ?? '';
      query += cond;
    }

    return query;
  }

  private buildCityCondition(p, k, v) {
    const city = `${v.city.replace(/'/g, '\'\'')}`;
    return ` and (MATCH(${k}.city, '${city}', 'fuzziness=AUTO') OR ${k}.city IS NULL)`;
  }

  private async buildRangeCondition(p, k, unit: Types.Unit) {
    const rates = await lastValueFrom(this.notificationClient.send({ role: 'currency', cmd: 'get-rates' }, {}));
    const convertedUnit: Types.Unit = {
      usd: (v) => {
        const rate = rates['usd-cad'];
        return {
          value: v * rate,
          measure: Types.MeasureCurrency.CAD,
        };
      },
      cad: (v) => {
        const rate = rates['cad-usd'];
        return {
          value: v * rate,
          measure: Types.MeasureCurrency.USD,
        };
      },
      sqm: (v) => {
        const rate = 10.7639;
        return {
          value: v * rate,
          measure: Types.MeasureSquare.SQFT,
        };
      },
      sqft: (v) => {
        const rate = 0.092903;
        return {
          value: v * rate,
          measure: Types.MeasureSquare.SQM,
        };
      },
    }[unit.measure](unit.value);

    // eslint-disable-next-line max-len
    const originalCondition = `${p}.${k}.range.lowest <= ${unit.value} and ${p}.${k}.range.highest >= ${unit.value} and ${p}.${k}.measure = '${unit.measure}'`;
    let convertedCondition = ' 1=1 ';
    if (convertedUnit) {
      // eslint-disable-next-line max-len
      convertedCondition = `${p}.${k}.range.lowest <= ${convertedUnit.value} and ${p}.${k}.range.highest >= ${convertedUnit.value} and ${p}.${k}.measure = '${convertedUnit.measure}'`;
    }

    return ` and ((${originalCondition}) or (${convertedCondition}) or ${p}.${k}.measure is null)`;
  }
}
