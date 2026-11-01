import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateBillingProfileDto {
  @ApiProperty({ example: 'Jan Kowalski' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  billingName!: string;

  @ApiPropertyOptional({ example: '5252445767' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(32)
  billingTaxId?: string;

  @ApiProperty({ example: 'ul. Przykładowa 10' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  billingStreet!: string;

  @ApiProperty({ example: 'Warszawa' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  billingCity!: string;

  @ApiProperty({ example: '00-001' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  billingPostalCode!: string;

  @ApiProperty({ example: 'PL' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Length(2, 2)
  billingCountry!: string;
}
