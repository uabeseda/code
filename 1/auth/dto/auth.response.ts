import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from './user.dto';

export class AuthResponse {
  @ApiProperty()
  readonly accessToken: string;

  @ApiProperty()
  readonly user: UserDto;
}
