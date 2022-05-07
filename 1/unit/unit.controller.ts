import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { UnitService } from './unit.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitDto } from './dto/unit.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserDto } from '../auth/dto/user.dto';
import { S3StorageService } from '../storages/s3-storage.service';
import { S3UrlRequest } from '../storages/dto/s3-url.request';
import { S3UrlResponse } from '../storages/dto/s3-url.response';
import { UnitType } from '../types';
import { OverrideAnetaPackDto } from '../aneta-pack/dto/override-aneta-pack.dto';
import { MergeAnetaPackDto } from '../aneta-pack/dto/merge-aneta-pack.dto';
import { AnetaPackStatsResponse } from './dto/aneta-pack-stats.response';
import { InjectUserType } from '../decorators';
import { AllowUnsubscribed } from '../payments/payments.decorators';

@ApiTags('units')
@Controller('units')
export class UnitController {
  constructor(
    private readonly unitService: UnitService,
    private readonly s3StorageService: S3StorageService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: UnitDto })
  @Post()
  @HttpCode(HttpStatus.OK)
  @InjectUserType()
  create(
    @Request() req,
    @Body() createUnitDto: CreateUnitDto,
  ): Promise<UnitDto> {
    const user: UserDto = req.user;
    return this.unitService.create(createUnitDto, user);
  }

  @AllowUnsubscribed()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: [UnitDto] })
  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(@Request() req): Promise<UnitDto[]> {
    const user: UserDto = req.user;
    return this.unitService.findAll(user, [UnitType.SCHOLAR, UnitType.CLASS]);
  }

  @UseGuards(JwtAuthGuard)
  @ApiCreatedResponse({ type: AnetaPackStatsResponse })
  @Get(':id/stat')
  getStat(@Param('id') id: string, @Request() req) {
    return this.unitService.getStat(+id, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: UnitDto })
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(@Request() req, @Param('id') id: number): Promise<UnitDto> {
    const user: UserDto = req.user;
    return this.unitService.findOne(id, user);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Put(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id') id: string,
    @Body() updateUnitDto: UpdateUnitDto,
    @Request() req,
  ) {
    const user: UserDto = req.user;
    return this.unitService.update(+id, updateUnitDto, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.unitService.remove(+id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/avatars')
  @ApiBearerAuth()
  @ApiOkResponse({ type: S3UrlResponse })
  @HttpCode(HttpStatus.OK)
  createAvatarUploadingLink(
    @Request() req,
    @Body() request: S3UrlRequest,
  ): Promise<S3UrlResponse> {
    const user: UserDto = req.user;
    return this.s3StorageService.getAvatarUploadingLink(user.id, request.type);
  }

  @ApiBody({ type: Map })
  @UseGuards(JwtAuthGuard)
  @Put(':id/override')
  override(
    @Body() overrideAnetaPackDto: OverrideAnetaPackDto,
    @Request() req,
    @Param('id') id: number,
  ) {
    if (!overrideAnetaPackDto.repeat) {
      overrideAnetaPackDto.repeat = 1;
    }
    return this.unitService.override(id, overrideAnetaPackDto, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/merge')
  merge(
    @Body() mergeAnetaPackDto: MergeAnetaPackDto,
    @Request() req,
    @Param('id') id: number,
  ) {
    return this.unitService.merge(id, mergeAnetaPackDto, req.user);
  }
}
