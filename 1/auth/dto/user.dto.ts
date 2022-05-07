import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { UserEntity } from '../../entities/user.entity';
import { ProfileEntity } from '../../entities/profile.entity';
import { UserType } from '../../types';
import { UserSubscriptionStatus } from '../../payments/payments.types';

type InheritedProperties = Partial<
  Pick<
    ProfileEntity,
    | 'subscriptionStatus'
    | 'stripeCustomerId'
    | 'subscriptionPlanId'
    | 'subscriptionTrialExpiration'
    | 'subscriptionExpiration'
  >
>;

export class UserDto implements InheritedProperties {
  constructor(
    entity: UserEntity,
    tokenId?: number,
    returnTeacherInsteadOfAnetaTeacher?: boolean,
  ) {
    this.id = entity.id;
    this.email = entity.email;
    if (entity.profile) {
      this.fullName = entity.profile.fullName;
      this.subscriptionStatus = entity.profile.subscriptionStatus;
      this.stripeCustomerId = entity.profile.stripeCustomerId;
      this.subscriptionPlanId = entity.profile.subscriptionPlanId;
      this.subscriptionTrialExpiration =
        entity.profile.subscriptionTrialExpiration;
      this.subscriptionExpiration = entity.profile.subscriptionExpiration;
    }
    this.emailVerified = entity.emailVerified;
    this.type =
      returnTeacherInsteadOfAnetaTeacher &&
      entity.profile.type === UserType.ANETA_TEACHER
        ? UserType.TEACHER
        : entity.profile.type;
    this.tokenId = tokenId;
  }

  @ApiProperty()
  readonly id?: number;

  @ApiProperty()
  @IsNotEmpty()
  readonly email: string;

  @ApiProperty()
  @IsNotEmpty()
  readonly emailVerified: boolean;

  @ApiProperty()
  readonly type: string;

  @ApiProperty()
  readonly fullName: string;

  readonly tokenId?: number;

  @ApiPropertyOptional({ enum: UserSubscriptionStatus })
  readonly subscriptionStatus?: UserSubscriptionStatus;

  @ApiPropertyOptional({
    description: 'ID of the Stripe.Customer entity that is bound to this user',
  })
  readonly stripeCustomerId?: string;

  @ApiPropertyOptional({
    description: 'ID of the Stripe.Price that the subscription will charge for',
  })
  readonly subscriptionPlanId?: string;

  @ApiPropertyOptional({
    description:
      'Trial expiration timestamp in milliseconds. Will not change over time',
  })
  readonly subscriptionTrialExpiration?: number;

  @ApiPropertyOptional({
    description:
      'The expiration timestamp in milliseconds of the current paid period (month/year). Will be updated as the subscription renews',
  })
  readonly subscriptionExpiration: number;
}
