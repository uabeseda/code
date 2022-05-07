import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../entities/user.entity';
import { jwtConstants } from '../constants';
import { ConfigModule } from '@nestjs/config';
import { UserTokenEntity } from '../entities/user-token.entity';
import { TokenCronService } from './token-cron.service';
import { TeacherProfileEntity } from '../entities/teacher-profile.entity';
import { ParentProfileEntity } from '../entities/parent-profile.entity';
import { PaymentsModule } from '../payments/payments.module';
import { UserReferralModule } from '../user-referral/user-referral.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([
      UserEntity,
      UserTokenEntity,
      TeacherProfileEntity,
      ParentProfileEntity,
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: {
        expiresIn: jwtConstants.expiresIn / 1000,
        issuer: jwtConstants.iss,
      },
    }),
    PaymentsModule,
    UserReferralModule,
  ],
  providers: [AuthService, TokenCronService, JwtStrategy],
  exports: [AuthService, TokenCronService],
  controllers: [AuthController],
})
export class AuthModule {}
