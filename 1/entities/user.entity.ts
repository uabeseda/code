import {
  BaseEntity,
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { bcryptConstants } from '../constants';
import { UserTokenEntity } from './user-token.entity';
import { ProfileEntity } from './profile.entity';
import { UnitEntity } from './unit.entity';
import { AnetaPackEntity } from './aneta-pack.entity';

@Entity('users')
export class UserEntity extends BaseEntity {
  static readonly relationToProfile = 'profile';
  static readonly relationToTokens = 'tokens';

  @PrimaryGeneratedColumn() id?: number;

  @Column({
    type: 'varchar',
    nullable: false,
    unique: true,
  })
  email: string;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({
    type: 'varchar',
    nullable: false,
    select: false,
  })
  password: string;

  @OneToOne(() => ProfileEntity, (p) => p.user, {
    cascade: true,
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  profile: ProfileEntity;

  @OneToMany(() => UnitEntity, (unit) => unit.user, {
    lazy: false,
    eager: true,
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  units: UnitEntity[];

  @OneToMany(() => AnetaPackEntity, (anetaPack) => anetaPack.createdBy, {
    lazy: false,
    eager: true,
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  creator: UnitEntity[];

  @OneToMany(() => UserTokenEntity, (token) => token.user, {
    lazy: false,
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  tokens: UserTokenEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: number;

  @BeforeInsert()
  @BeforeUpdate()
  async toUserEntity() {
    if (this.password) {
      this.password = await bcrypt.hash(this.password, bcryptConstants.salt);
    }
  }
}
