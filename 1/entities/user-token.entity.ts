import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from '../auth/dto/user.dto';
import { jwtConstants } from '../constants';
import {
  BaseEntity,
  BeforeInsert,
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('user-tokens')
export class UserTokenEntity extends BaseEntity {
  static readonly relationToUser = 'user';

  @ApiProperty()
  @PrimaryGeneratedColumn()
  id?: number;

  @ApiProperty()
  @Column()
  createDate: Date;

  @ApiProperty()
  @Column()
  expireDate: Date;

  @ApiProperty({ type: UserDto })
  @ManyToOne(() => UserEntity, user => user.tokens, { onDelete: 'CASCADE' })
  user: UserEntity;

  @BeforeInsert()
  setDates() {
    this.createDate = new Date();
    this.expireDate = new Date(Date.now() + jwtConstants.expiresIn);
  }
}
