import { BaseEntity, Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('black-list')
@Unique(['link'])
export class BlackListEntity extends BaseEntity {
  @PrimaryGeneratedColumn() id?: number;

  @Column()
  link: string;
}
