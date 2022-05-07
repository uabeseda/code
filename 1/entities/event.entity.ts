import {
  BaseEntity,
  BeforeInsert, BeforeUpdate,
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UnitToEventEntity } from './unit-to-event.entity';
import { ConfirmCredentialsService } from '../confirm-credentials/confirm-credentials.service';
import { UnitEntity } from './unit.entity';

@Entity('events')
export class EventEntity extends BaseEntity {

  @PrimaryGeneratedColumn() id?: number;

  @Column({nullable: true})
  parentId: number;

  @ManyToOne(() => EventEntity, e => e.children, {onDelete: 'SET NULL', })
  parent: EventEntity;

  @OneToMany(() => EventEntity, e => e.parent, {onDelete: 'SET NULL'})
  children: EventEntity[];

  @OneToMany(() => UnitToEventEntity, ute => ute.event, { onDelete: 'CASCADE', lazy: false })
  public unitToEventEntities!: UnitToEventEntity[];

  @Column()
  title: string;

  @Column()
  subject: string;

  @Column({ nullable: true })
  link: string;

  @Column({ nullable: true })
  linkType: string;

  @Column({ type: 'timestamp without time zone' })
  startTime: Date;

  @Column({ type: 'timestamp without time zone' })
  endTime: Date;

  @Column({ nullable: true })
  repeat: string;

  unit: UnitEntity;

  @BeforeInsert()
  @BeforeUpdate()
  async prePopulateSignIn() {
    if (this.link && this.unit) {
      await ConfirmCredentialsService.createSignInCredentialEntity(this.link, this.unit.id);
    }
  }
}
