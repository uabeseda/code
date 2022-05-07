import { ChildEntity } from "typeorm";
import { ProfileEntity } from "./profile.entity";

@ChildEntity('aneta-teacher')
export class AnetaTeacherProfileEntity extends ProfileEntity {

}
