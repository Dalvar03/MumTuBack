import { DisputeReason } from '@prisma/client';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateJobDisputeDto {
  @IsEnum(DisputeReason)
  reason!: DisputeReason;

  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  description!: string;
}
