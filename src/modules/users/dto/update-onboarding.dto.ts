import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum UserRoleDto {
  CLIENT = 'CLIENT',
  WORKER = 'WORKER',
}

export class UpdateOnboardingDto {
  @ApiProperty({
    enum: UserRoleDto,
    example: UserRoleDto.CLIENT,
    description: 'User role in the system',
  })
  @IsEnum(UserRoleDto)
  role!: UserRoleDto;

  @ApiProperty({
    example: 'john_doe',
    description: 'Username (min 3 characters, trimmed)',
  })
  @IsString()
  @MinLength(3)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  username!: string;

  @ApiPropertyOptional({
    example: 'Warsaw',
    description: 'City where user is located',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  city?: string;

  @ApiPropertyOptional({
    example: 25,
    description:
      'Work radius in kilometers (1–500). Empty string or null will be ignored',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    return Number(value);
  })
  @IsInt()
  @Min(1)
  @Max(500)
  workRadiusKm?: number;

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

  @ApiProperty({ example: 'Shevchenka 10, Lviv' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  address?: string;

  @ApiProperty({ example: '38012134123' })
  @IsOptional()
  @IsString()
  @MaxLength(15)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  phoneNumber?: string;
}
