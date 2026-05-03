import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class TakeJobDto {
  @ApiProperty({ example: 'IBAN: PL..., Name: Lukazsh Lukazsh' })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  payoutDetails?: string;
}
