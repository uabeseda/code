import {
  ChildEntity,
  Column,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { AnetaPackType } from '../types';
import { UnitEntity } from './unit.entity';

@ChildEntity('aneta-pack')
export class AnetaPackEntity extends UnitEntity {
  @PrimaryGeneratedColumn() id?: number;

  @Column({ type: 'timestamp without time zone' })
  startTime: Date;

  @Column()
  anetaPackType: AnetaPackType;

  @Column()
  createdById: number;

  @ManyToOne(() => UserEntity, user => user.creator, {nullable: true})
  @JoinColumn()
  createdBy: UserEntity;

  @Column()
  parentId: number;

  @ManyToOne(() => UnitEntity)
  @JoinColumn()
  parent: UnitEntity|AnetaPackEntity;

  @Column({ default: false })
  isApplied: boolean;

  // @CreateDateColumn({type: 'timestamp', nullable: false, default: () => 'CURRENT_TIMESTAMP(6)'})
  // createdAt: Date;
}
