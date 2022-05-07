import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserReferralEntity } from './user-referral.entity';
import { UserReferralBonus } from '../types';

@Entity('user-referral-bonus')
export class UserReferralBonusEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: UserReferralBonus,
    nullable: false,
  })
  bonus: UserReferralBonus;

  @OneToOne(
    () => UserReferralEntity,
    (userReferral) => userReferral.referralBonus,
    {
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'referral_id' })
  referral: UserReferralEntity;
}
