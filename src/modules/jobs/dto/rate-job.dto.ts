import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class RateJobDto {
  @ApiProperty({ example: '12345678' })
  @IsString()
  jobId!: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  value!: number;

  @ApiPropertyOptional({ example: 'Excellent work' })
  @IsOptional()
  @IsString()
  comment?: string;
}
