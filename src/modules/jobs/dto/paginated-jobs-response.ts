import { ApiProperty } from '@nestjs/swagger';
import { JobResponseDto } from './job-response.dto';
import { PaginatedResponseDto } from 'src/common/dtos/pagination-response.dto';

export class PaginatedJobsResponseDto extends PaginatedResponseDto<JobResponseDto> {
  @ApiProperty({ type: JobResponseDto, isArray: true })
  declare data: JobResponseDto[];
}
