import { PropertyDto } from 'domally-utils';

export class ResponseFindAllPropertyDto {
  properties: PropertyDto[];
  page: number;
  pageCount: number;
  limit: number;
}
