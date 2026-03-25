import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export enum UserRoleDto {
  CLIENT = 'CLIENT',
  WORKER = 'WORKER',
}

export class UpdateOnboardingDto {
  @IsEnum(UserRoleDto)
  role: UserRoleDto;

  @IsString()
  @MinLength(3)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  username: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  city?: string;

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
}
