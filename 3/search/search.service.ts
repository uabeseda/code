import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { SearchDto } from 'domally-utils/index';

@Injectable()
export class SearchService {
  constructor(@Inject('SEARCH_SERVICE') private searchClient: ClientProxy) {}

  async index(role: string, data: object, options?: { ignoreExceptions: boolean, cmd?: string }) {
    try {
      const cmd = options?.cmd ?? 'index';
      return await lastValueFrom(this.searchClient.send({ role, cmd }, data));
    } catch (e) {
      if (!options?.ignoreExceptions) {
        throw e;
      }
    }
  }

  async search(indexName: string, searchDto: SearchDto, ignoreExceptions = false) {
    try {
      return await lastValueFrom(this.searchClient.send({ role: indexName, cmd: 'search' }, searchDto));
    } catch (e) {
      // todo: log exception
      throw e;
    }
  }

  async remove(indexName: string, data: object, ignoreExceptions = false) {
    try {
      return await lastValueFrom(this.searchClient.send({ role: indexName, cmd: 'remove' }, data));
    } catch (e) {
      if (!ignoreExceptions) {
        throw e;
      }
    }
  }
}
