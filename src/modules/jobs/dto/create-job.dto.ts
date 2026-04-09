import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateJobDto {
  @ApiProperty({ example: 'General apartment cleaning' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  title: string;

  @ApiProperty({
    example: 'Need cleaning after rental for a 3-room apartment',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  description: string;

  @ApiProperty({ example: 350 })
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ example: 'Lviv' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  city: string;

  @ApiProperty({
    example: 'Cleaning',
  })
  @MinLength(3)
  @MaxLength(255)
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  category: string;

  @ApiProperty({ example: 'Shevchenka 10, Lviv' })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  address: string;

  @ApiPropertyOptional({ example: 49.8397 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === undefined || value === null || value === ''
      ? undefined
      : Number(value),
  )
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: 24.0297 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === undefined || value === null || value === ''
      ? undefined
      : Number(value),
  )
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ example: 'ChIJ...' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  placeId?: string;
}
