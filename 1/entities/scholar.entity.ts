import { ChildEntity } from 'typeorm';
import { UnitEntity } from './unit.entity';

@ChildEntity('scholar')
export class ScholarEntity extends UnitEntity {
}
