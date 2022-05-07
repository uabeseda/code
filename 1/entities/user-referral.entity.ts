import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  LessThanOrEqual,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { UserReferralStatus } from '../types';
import { UserReferralBonusEntity } from './user-referral-bonus.entity';
import { getEndOfYearDate } from '../user-referral/user-referral.utils';

@Entity('user-referral')
export class UserReferralEntity extends BaseEntity {
  static referralBonusRelation = 'referralBonus';

  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: UserReferralStatus,
    default: UserReferralStatus.INVITATION_SENT,
  })
  status: UserReferralStatus;

  @Column({ name: 'owner_id' })
  ownerId: number;

  @Column({ name: 'referred_email' })
  referredEmail: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'owner_id' })
  owner: UserEntity;

  @OneToOne(() => UserEntity, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn({
    name: 'referred_email',
    referencedColumnName: 'email' as keyof UserEntity,
  })
  referred: UserEntity;

  @OneToOne(
    () => UserReferralBonusEntity,
    (referralBonus) => referralBonus.referral,
    {
      cascade: true,
    },
  )
  referralBonus?: UserReferralBonusEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  static getYearlyReferralsQuery(ownerId: number) {
    return {
      ownerId,
      createdAt: LessThanOrEqual(getEndOfYearDate()),
    };
  }

  static getAcceptedYearlyReferralsQuery(ownerId: number) {
    return {
      ...UserReferralEntity.getYearlyReferralsQuery(ownerId),
      status: UserReferralStatus.REFERRAL_SIGNED_UP,
    };
  }
}
