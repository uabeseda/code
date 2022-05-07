import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { AnetaPackService } from './aneta-pack.service';
import { CreateAnetaPackDto } from './dto/create-aneta-pack.dto';
import { UpdateAnetaPackDto } from './dto/update-aneta-pack.dto';
import { ApiBody, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ShareAnetaPackDto } from './dto/share-aneta-pack.dto';

@ApiTags('aneta-packs')
@ApiBearerAuth()
@Controller('aneta-packs')
export class AnetaPackController {
  constructor(private readonly anetaPackService: AnetaPackService) {
  }

  @UseGuards(JwtAuthGuard)
  @ApiBody({ type: CreateAnetaPackDto })
  @Post()
  create(@Body() createAnetaPackDto: CreateAnetaPackDto, @Request() req) {
    return this.anetaPackService.create(createAnetaPackDto, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBody({ type: ShareAnetaPackDto })
  @Post(':id/share')
  share(
    @Body() shareAnetaPackDto: ShareAnetaPackDto,
    @Request() req,
    @Param('id') id: number,
  ) {
    return this.anetaPackService.share(id, shareAnetaPackDto, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(
    @Request() req,
    @Query('name') name: string,
    @Query('curator') curator: string[],
    @Query('grade') grade: string[],
    @Query('skill') skill: string[],
    @Query('interest') interest: string[],
  ) {
    if (curator) {
      if (curator && !Array.isArray(curator)) {
        curator = [curator];
      }
    }
    if (grade && !Array.isArray(grade)) {
      // @ts-ignore
      grade = [grade];
    }
    if (skill && !Array.isArray(skill)) {
      // @ts-ignore
      skill = [skill];
    }
    if (interest && !Array.isArray(interest)) {
      // @ts-ignore
      interest = [interest];
    }
    return this.anetaPackService.findAll({ userId: req.user.id, name, curator, grade, skill, interest });
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.anetaPackService.findOne(+id, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(@Param('id') id: string, @Body() updateAnetaPackDto: UpdateAnetaPackDto) {
    return this.anetaPackService.update(+id, updateAnetaPackDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.anetaPackService.remove(+id);
  }
}
