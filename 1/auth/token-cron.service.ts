import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserTokenEntity } from '../entities/user-token.entity';
import { LessThan, Repository } from 'typeorm';
import {
  Loggable,
  UseLoggerInstance,
} from '../service-info/service-info.with-logging.decorator';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
@Loggable()
export class TokenCronService {
  @InjectPinoLogger(TokenCronService.name)
  @UseLoggerInstance()
  private readonly logger: PinoLogger;

  constructor(
    @InjectRepository(UserTokenEntity)
    private readonly tokenRepository: Repository<UserTokenEntity>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  clearExpiredTokenEntities() {
    console.log('Cron job: clearExpiredTokenEntities');
    this.tokenRepository.delete({
      expireDate: LessThan(new Date()),
    });
  }
}
