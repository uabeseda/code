import { BaseEntity, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { UnitEntity } from './unit.entity';

@Entity('device')
export class DeviceEntity extends BaseEntity {
  @PrimaryColumn()
  token: string;

  @ManyToOne(() => UnitEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unit_id' })
  public unitId: number;

  @CreateDateColumn({ name: 'created_at' })
  public createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  public updatedAt!: Date;
}
