import {
  BaseEntity,
  Column,
  Entity, JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  TableInheritance,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { UnitToEventEntity } from './unit-to-event.entity';
import { DigitalResourceEntity } from './digital-resource.entity';
import { ConfirmCredentialEntity } from './confirm-credential.entity';

@Entity('units')
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export abstract class UnitEntity extends BaseEntity {
  static readonly relationToUser = 'user';

  protected constructor() {
    super();
  }

  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  name: string;

  @Column()
  type: string;

  @Column({ type: 'varchar', array: true, default: ['Other'] })
  grades: string[];

  @Column({
    nullable: true,
  })
  avatar?: string;

  @Column({ type: 'jsonb', nullable: true })
  settings?: object;

  @Column({nullable: true})
  userId: number;

  @ManyToOne(() => UserEntity, user => user.units)
  @JoinColumn()
  user: UserEntity;

  @OneToMany(() => UnitToEventEntity, ute => ute.unit, {
    onDelete: 'CASCADE',
  })
  public unitToEventEntities!: UnitToEventEntity[];

  @OneToMany(() => DigitalResourceEntity, dr => dr.unit, {
    cascade: true, onDelete: 'CASCADE',
  })
  public digitalResources: DigitalResourceEntity[];

  @Column({ type: 'varchar', array: true, nullable: true })
  skills?: string[];

  @Column({ type: 'varchar', array: true, nullable: true })
  interests?: string[];

  @OneToMany(() => ConfirmCredentialEntity, (cc) => cc.unit, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  public confirmCredentials: ConfirmCredentialEntity[];

  static async getUnitById(id, userId): Promise<UnitEntity> {
    return UnitEntity.findOne({ id, user: { id: userId } });
  }

  static async getUnits({ userId, unitTypes }): Promise<UnitEntity[]> {
    const query = UnitEntity.createQueryBuilder('unit')
      .where('unit.userId = :userId', { userId });
    if (unitTypes) {
      query.andWhere('unit.type IN (:...unitTypes)', { unitTypes });
    }
    return query.getMany();
  }

}
