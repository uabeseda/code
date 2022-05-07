import { Controller, Inject, ValidationPipe } from '@nestjs/common';
import { SearchService } from './search.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SearchDto } from 'domally-utils';

@Controller()
export class SearchController {
  constructor(@Inject(SearchService) private readonly searchService: SearchService) {}

  @MessagePattern({ role: 'property', cmd: 'index' })
  indexProperty(@Payload() req) {
    return this.searchService.indexProperty(req);
  }

  @MessagePattern({ role: 'property', cmd: 'bulk-rebuild' })
  bulkRebuildProperty(@Payload() req) {
    return this.searchService.bulkRebuildProperty(req);
  }

  @MessagePattern({ role: 'search', cmd: 'bulk-rebuild' })
  bulkRebuildSearch(@Payload() req) {
    return this.searchService.bulkRebuildSearch(req);
  }

  @MessagePattern({ role: 'property', cmd: 'search' })
  searchProperty(@Payload(new ValidationPipe({transform: true})) searchDto: SearchDto) {
    return this.searchService.searchProperty(searchDto);
  }

  @MessagePattern({ role: 'property', cmd: 'remove' })
  removeProperty(@Payload() req) {
    return this.searchService.remove({ index: SearchService.PROPERTY_INDEX, ...req });
  }

  @MessagePattern({ role: 'search', cmd: 'remove' })
  removeSearch(@Payload() req: { userId: number }) {
    return this.searchService.remove({ index: SearchService.USER_FILTER_INDEX, ...req });
  }
}
