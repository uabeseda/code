import { BaseEntity, Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { UnitEntity } from './unit.entity';
import { EventEntity } from './event.entity';

@Entity('unit-to-event')
export class UnitToEventEntity extends BaseEntity {
  static readonly relationToUnit = 'unit';
  static readonly relationToEvent = 'event';

  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  public unitId!: number;

  @Column()
  public eventId!: number;

  @Column({ default: false })
  isStarted: boolean;

  @ManyToOne(() => UnitEntity, u => u.unitToEventEntities, {
    onDelete: 'CASCADE'
  })
  @JoinColumn()
  public unit!: UnitEntity;

  @ManyToOne(() => EventEntity, category => category.unitToEventEntities, {
    onDelete: 'CASCADE'
  })
  @JoinColumn()
  public event!: EventEntity;
}
