import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dtos/pagination-query.dto';
import { Transform } from 'class-transformer';

export class OpenJobsQueryDto extends PaginationQueryDto {
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
