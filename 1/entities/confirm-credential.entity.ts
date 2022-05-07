import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UnitEntity } from './unit.entity';

@Entity('confirm-credential')
export class ConfirmCredentialEntity extends BaseEntity {
  @PrimaryGeneratedColumn() id?: number;

  @Column()
  url: string;

  @Column({ nullable: true })
  tested?: boolean;

  @Column()
  unitId: number;

  @ManyToOne(
    () => UnitEntity,
    (unit) => unit.confirmCredentials,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn()
  unit: UnitEntity;
}
