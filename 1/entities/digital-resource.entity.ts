import {
  BaseEntity,
  BeforeInsert, BeforeUpdate,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { UnitEntity } from './unit.entity';
import { ConfirmCredentialsService } from '../confirm-credentials/confirm-credentials.service';

@Entity('digital-resources')
@Unique(['unitId', 'link'])
export class DigitalResourceEntity extends BaseEntity {
  @PrimaryGeneratedColumn() id?: number;

  @Column()
  link: string;

  @Column({ nullable: true })
  type: string;

  @Column()
  unitId: number;

  @ManyToOne(() => UnitEntity, u => u.digitalResources, { onDelete: 'CASCADE' })
  @JoinColumn()
  unit: UnitEntity;

  @BeforeInsert()
  @BeforeUpdate()
  async prePopulateSignIn() {
    const unitId = this.unit?.id || this.unitId;
    if (this.link && unitId) {
      await ConfirmCredentialsService.createSignInCredentialEntity(this.link, unitId);
    }
  }
}
