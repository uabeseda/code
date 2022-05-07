import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { JwtPayload } from './interfaces/payload.interface';
import { SigninRequest } from './dto/signin.request';
import { JwtService } from '@nestjs/jwt';
import { UserEntity } from '../entities/user.entity';
import { RegistrationRequest } from './dto/registration.request';
import * as bcrypt from 'bcrypt';
import { UserDto } from './dto/user.dto';
import { AuthResponse } from './dto/auth.response';
import { pgErors, twillioServices } from '../constants';
import { UserTokenEntity } from '../entities/user-token.entity';
import { InjectTwilio, TwilioClient } from 'nestjs-twilio';
import { ResetPasswordRequest } from './dto/reset-password.request';
import { ResetPasswordDataRequest } from './dto/reset-password-data.request';
import { TeacherProfileEntity } from '../entities/teacher-profile.entity';
import { ParentProfileEntity } from '../entities/parent-profile.entity';
import { UserType } from '../types';
import { Connection, EntityManager, IsNull } from 'typeorm';
import { PaymentsService } from '../payments/payments.service';
import { configService } from '../config/config.service';
import { UserReferralService } from '../user-referral/user-referral.service';
import { InjectConnection } from '@nestjs/typeorm';
import {
  Loggable,
  UseLoggerInstance,
} from '../service-info/service-info.with-logging.decorator';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
@Loggable()
export class AuthService {
  @InjectPinoLogger(AuthService.name)
  @UseLoggerInstance()
  private readonly logger: PinoLogger;

  constructor(
    private readonly jwtService: JwtService,
    @InjectTwilio() private readonly twilioClient: TwilioClient,
    private readonly paymentsService: PaymentsService,
    private readonly referralService: UserReferralService,
    @InjectConnection() private readonly dbConnection: Connection,
  ) {}

  async register(registerData: RegistrationRequest): Promise<AuthResponse> {
    return this.dbConnection.transaction(async (manager) => {
      let user: UserEntity;

      const email = registerData.email.toLowerCase();
      user = await UserEntity.findOne({ email: email, profile: IsNull() });

      if (!user) {
        user = new UserEntity();
        user.email = email;
      }
      user.password = registerData.password;

      let profile: TeacherProfileEntity | ParentProfileEntity;
      if (registerData.userType.toLowerCase() === UserType.TEACHER) {
        profile = new TeacherProfileEntity();
        profile.type = UserType.TEACHER;
      } else if (registerData.userType.toLowerCase() === UserType.PARENT) {
        profile = new ParentProfileEntity();
        profile.type = UserType.PARENT;

        if (configService.getPaymentsConfig().subscriptionOn) {
          const customer = await this.paymentsService.createCustomer({
            email,
          });

          const trialSubscriptionDetails = await this.paymentsService.startTrial(
            {
              customerId: customer.id,
            },
          );

          Object.assign(profile, trialSubscriptionDetails);
        }
      } else {
        throw new BadRequestException({ message: 'Unknown user type' });
      }
      user.profile = profile;

      try {
        const userEntity = await manager.save(user);

        if (typeof registerData.referralOwnerId === 'number') {
          await this.referralService.logRegistration({
            ownerId: registerData.referralOwnerId,
            referredEmail: userEntity.email,
            manager,
          });
        }
        // await this.sendEmailVerification(user);

        return {
          accessToken: await this._createToken(userEntity, { manager }),
          user: new UserDto(userEntity),
        };
      } catch (e) {
        if (e?.code === pgErors.unique_violation) {
          throw new BadRequestException({ message: 'Email already exists!' });
        }

        throw e;
      }
    });
  }

  private async sendEmailVerification(user: UserEntity) {
    try {
      await this.twilioClient.verify
        .services(twillioServices.EMAIL_VERIFICATION_SERVICE)
        .verifications.create({
          channelConfiguration: {
            substitutions: {
              to: user.email,
              callback_url: `${process.env.OWN_HOST}/auth/email/`,
            },
          },
          to: user.email,
          channel: 'email',
        });
    } catch (e) {
      // todo: log error
    }
  }

  async signIn(signInData: SigninRequest): Promise<AuthResponse> {
    const email = signInData.email.toLowerCase();
    const userEntity = await UserEntity.findOne(
      {
        email,
      },
      {
        select: ['id', 'email', 'password', 'emailVerified'],
        relations: [UserEntity.relationToProfile],
      },
    );

    if (!userEntity) {
      throw new HttpException(
        'Invalid email or password!',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const isValidUser = await bcrypt.compare(
      signInData.password,
      userEntity.password,
    );

    if (!isValidUser) {
      throw new HttpException(
        'Invalid email or password!',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return {
      accessToken: await this._createToken(userEntity),
      user: new UserDto(userEntity),
    };
  }

  private async _createToken(
    user: UserEntity,
    options?: { manager: EntityManager },
  ): Promise<string> {
    const tokenEntity = new UserTokenEntity();
    tokenEntity.user = user;

    let token: UserTokenEntity;
    if (options?.manager) {
      token = await options.manager.save(tokenEntity);
    } else {
      token = await tokenEntity.save();
    }

    const payload: JwtPayload = {
      id: token.id,
      aud: user.id,
      email: user.email,
    };

    return this.jwtService.sign(payload);
  }

  async validateUser(payload: JwtPayload): Promise<UserDto> {
    const tokenEntity = await UserTokenEntity.findOne(payload.id, {
      relations: [UserTokenEntity.relationToUser],
    });

    if (!tokenEntity || tokenEntity.user.id !== payload.aud) {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }

    return new UserDto(tokenEntity.user, payload.id);
  }

  async logout(user: UserDto): Promise<void> {
    await UserTokenEntity.delete({
      id: user.tokenId,
    });
  }

  async verifyEmail(email: string, code: string): Promise<void> {
    const result = await this.twilioClient.verify
      .services(twillioServices.EMAIL_VERIFICATION_SERVICE)
      .verificationChecks.create({ to: email, code: code });

    if (result.valid) {
      await UserEntity.update(
        {
          email: email,
        },
        {
          emailVerified: true,
        },
      );
    } else {
      throw new HttpException('Invalid code', HttpStatus.UNAUTHORIZED);
    }
  }

  async resetPasswordRequest(
    resetPasswordRequest: ResetPasswordRequest,
  ): Promise<void> {
    const user = await UserEntity.findOne({email: resetPasswordRequest.email});
    if (!user) {
      throw new BadRequestException({ message: 'This account is not registered in the system.' });
    }
    await this.twilioClient.verify
      .services(twillioServices.RESET_PASSWORD_SERVICE)
      .verifications.create({
        channelConfiguration: {
          substitutions: {
            to: resetPasswordRequest.email,
            callback_url: `${process.env.FRONTEND_HOST}/change-password`,
          },
        },
        to: resetPasswordRequest.email,
        channel: 'email',
      });
  }

  async resetPassword(
    resetPasswordDataRequest: ResetPasswordDataRequest,
  ): Promise<void> {
    const user = await UserEntity.findOne({
      email: resetPasswordDataRequest.email,
    });

    // if (!user.emailVerified) {
    //   throw new HttpException('Email is not verified!', HttpStatus.FORBIDDEN);
    // }

    const result = await this.twilioClient.verify
      .services(twillioServices.RESET_PASSWORD_SERVICE)
      .verificationChecks.create({
        to: user.email,
        code: resetPasswordDataRequest.code,
      });

    if (result.valid) {
      user.password = resetPasswordDataRequest.newPassword;
      await UserEntity.save(user);
    } else {
      throw new HttpException('Invalid code', HttpStatus.UNAUTHORIZED);
    }
  }
}
