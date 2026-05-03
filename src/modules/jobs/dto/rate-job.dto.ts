import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RateJobDto {
  @ApiProperty({ example: '12345678' })
  jobId!: string;

  @ApiProperty({ example: 5 })
  value!: number; // 1–5

  @ApiPropertyOptional({ example: 'Excellent work' })
  comment?: string;
}
