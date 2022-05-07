import { ChildEntity } from "typeorm";
import { ProfileEntity } from "./profile.entity";

@ChildEntity('teacher')
export class TeacherProfileEntity extends ProfileEntity {

}
