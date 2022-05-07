import { ChildEntity } from "typeorm";
import { UnitEntity } from "./unit.entity";

@ChildEntity('class')
export class ClassEntity extends UnitEntity {
}
