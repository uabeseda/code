import {
  BaseEntity,
  Column,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
  TableInheritance,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { UserSubscriptionStatus } from '../payments/payments.types';

@Entity('profiles')
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export class ProfileEntity extends BaseEntity {
  @PrimaryGeneratedColumn() id?: number;

  @OneToOne(() => UserEntity, (user) => user.profile)
  user: UserEntity;

  @Column({ nullable: true })
  fullName: string;

  @Column()
  type: string;

  @Column({
    type: 'varchar',
    nullable: false,
    default: UserSubscriptionStatus.NONE,
  })
  subscriptionStatus: UserSubscriptionStatus;

  @Column({ nullable: true })
  stripeCustomerId: string;

  @Column({ nullable: true })
  subscriptionPlanId: string;

  @Column({ nullable: true })
  subscriptionTrialExpiration: number;

  @Column({ nullable: true })
  subscriptionExpiration: number;
}
