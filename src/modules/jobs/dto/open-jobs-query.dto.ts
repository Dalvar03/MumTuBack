import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsNumber, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dtos/pagination-query.dto';
import { Transform } from 'class-transformer';
import { JobStatus } from '@prisma/client';

export class OpenJobsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: [JobStatus.OPEN],
    default: JobStatus.OPEN,
  })
  @IsOptional()
  @IsIn([JobStatus.OPEN])
  status?: JobStatus;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ example: 'Cleaning' })
  @IsOptional()
  category?: string;
}
