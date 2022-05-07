import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { NO_AUTH_CHECK_META_KEY } from './auth.decorators';
import {
  Loggable,
  UseLoggerInstance,
} from '../service-info/service-info.with-logging.decorator';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
@Loggable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  @InjectPinoLogger(JwtAuthGuard.name)
  @UseLoggerInstance()
  private logger: PinoLogger;

  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const noAuthCheck: boolean = this.reflector.getAllAndOverride(
      NO_AUTH_CHECK_META_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (noAuthCheck) {
      return true;
    }

    return super.canActivate(context);
  }
}
