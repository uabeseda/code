import { Module } from '@nestjs/common';
import { IsUrlRule } from './is-url';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlackListEntity } from '../entities/black-list.entity';
import { IsEmailExistsRule } from './is-email-exists';
import { IsDigitalResourceExistsRule } from './is-digital-resource-exists';

@Module({
  imports: [TypeOrmModule.forFeature([BlackListEntity])],
  providers: [IsUrlRule, IsEmailExistsRule, IsDigitalResourceExistsRule]
})
export class ValidatorModule {}
