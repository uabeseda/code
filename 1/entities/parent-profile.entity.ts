import { ChildEntity } from 'typeorm';
import { ProfileEntity } from './profile.entity';

@ChildEntity('parent')
export class ParentProfileEntity extends ProfileEntity {}
