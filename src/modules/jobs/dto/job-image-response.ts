import { ApiProperty } from '@nestjs/swagger';
export class JobImageResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() jobId: string;
  @ApiProperty() url: string;
  @ApiProperty() key: string;
  @ApiProperty() createdAt: Date;
}
