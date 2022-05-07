import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PropertyService } from './property.service';
import {
  PropertyDto,
  RemovePropertyDto,
  UpdatePropertyDto,
  LikePropertyDto,
  SearchDto,
  PropertyUserClaimDto,
  GetAllClaimsDto,
  AdminUpdatePropertyDto,
  GetAllPropertyDto,
  ClaimRequestDto,
} from 'domally-utils';
import { ResponseFindAllPropertyDto } from './dto';

@Controller()
export class PropertyController {
  constructor(private readonly propertyService: PropertyService) { }

  @MessagePattern({ role: 'property', cmd: 'create' })
  create(@Payload() createPropertyDto: PropertyDto) {
    return this.propertyService.create(createPropertyDto);
  }

  @MessagePattern({ role: 'property', cmd: 'update' })
  update(@Payload() updatePropertyDto: UpdatePropertyDto) {
    return this.propertyService.update(updatePropertyDto, {
      admin: false,
      userId: updatePropertyDto.userId,
    });
  }

  @MessagePattern({ role: 'property', cmd: 'update-admin' })
  updateAdmin(@Payload() adminUpdatePropertyDto: AdminUpdatePropertyDto) {
    return this.propertyService.update(adminUpdatePropertyDto.property, {
      admin: true,
      description: adminUpdatePropertyDto.description,
      adminId: adminUpdatePropertyDto.adminId,
    });
  }

  @MessagePattern({ role: 'property', cmd: 'create-test-admin' })
  createTestAdmin(@Payload() propertyDto: PropertyDto) {
    return this.propertyService.createTest(propertyDto);
  }

  @MessagePattern({ role: 'property', cmd: 'find-all' })
  findAll(
    @Payload() getAllPropertyDto: GetAllPropertyDto,
  ): Promise<ResponseFindAllPropertyDto> {
    return this.propertyService.findAll(getAllPropertyDto);
  }

  @MessagePattern({ role: 'property', cmd: 'get-favourites' })
  getFavourites(
    @Payload() getFavouritesPropertiesDto: GetAllPropertyDto,
  ): Promise<ResponseFindAllPropertyDto> {
    return this.propertyService.getFavourites(getFavouritesPropertiesDto);
  }

  @MessagePattern({ role: 'property', cmd: 'find-one' })
  findOne(@Payload() req: { id: number; userId?: number }) {
    return this.propertyService.findOne(req);
  }

  @MessagePattern({ role: 'property', cmd: 'get-by-ids' })
  getPropertiesByIds(@Payload() req: { ids: number[] }) {
    return this.propertyService.getPropertiesByIds(req);
  }

  @MessagePattern({ role: 'property', cmd: 'search' })
  search(@Payload() searchDto: SearchDto) {
    return this.propertyService.search(searchDto);
  }

  @MessagePattern({ role: 'property', cmd: 'search-by-location' })
  searchByLocation(@Payload() req: { ids: number[], query: string }) {
    return this.propertyService.searchByLocation(req);
  }

  @MessagePattern({ role: 'property', cmd: 'remove' })
  remove(@Payload() removeRequest: RemovePropertyDto) {
    return this.propertyService.remove(removeRequest);
  }

  @MessagePattern({ role: 'property', cmd: 'like' })
  like(@Payload() likeRequest: LikePropertyDto) {
    return this.propertyService.like(likeRequest);
  }

  @MessagePattern({ role: 'property', cmd: 'unlike' })
  unlike(@Payload() unlikeRequest: LikePropertyDto) {
    return this.propertyService.unlike(unlikeRequest);
  }

  @MessagePattern({ role: 'property', cmd: 'add-claim' })
  addPropertyClaim(@Payload() data: PropertyUserClaimDto) {
    return this.propertyService.addPropertyClaim(data);
  }

  @MessagePattern({ role: 'property', cmd: 'get-claims' })
  getPropertyClaims(@Payload() data: GetAllClaimsDto) {
    return this.propertyService.getPropertyClaims(data);
  }

  @MessagePattern({ role: 'property', cmd: 'get-claim' })
  getPropertyClaim(@Payload() id: number): Promise<PropertyUserClaimDto> {
    return this.propertyService.getPropertyClaim(id);
  }

  @MessagePattern({ role: 'property', cmd: 'delete-claim' })
  deletePropertyClaim(@Payload() removeRequest: RemovePropertyDto) {
    return this.propertyService.deleteClaim(removeRequest);
  }

  @MessagePattern({ role: 'property', cmd: 'approve-claim' })
  approveClaim(@Payload() req: ClaimRequestDto) {
    return this.propertyService.approveClaim(req);
  }

  @MessagePattern({ role: 'property', cmd: 'reject-claim' })
  rejectClaim(@Payload() req: ClaimRequestDto) {
    return this.propertyService.rejectClaim(req);
  }

  @MessagePattern({ role: 'property', cmd: 'rebuild-index' })
  rebuildIndex() {
    return this.propertyService.rebuildIndex();
  }
}
