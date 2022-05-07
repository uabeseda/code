import { ApiProperty } from '@nestjs/swagger';

export class AnetaPackStatsResponse {
  @ApiProperty()
  recipients: number;

  @ApiProperty()
  timesApplied: number;

  @ApiProperty()
  emails: string[];
}
