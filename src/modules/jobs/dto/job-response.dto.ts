import { ApiProperty } from '@nestjs/swagger';
import { JobStatus } from '@prisma/client';
import { UserResponseDto } from '../../users/dto/user-response.dto';

export class JobResponseDto {
  @ApiProperty({
    example: 'cm9job123abc456def',
  })
  id: string;

  @ApiProperty({
    example: 'Fix kitchen sink',
  })
  title: string;

  @ApiProperty({
    example: 'Need help fixing a leaking kitchen sink.',
  })
  description: string;

  @ApiProperty({
    example: '150.00',
    description: 'Decimal value returned as string in API responses',
  })
  price: string;

  @ApiProperty({
    example: 'Warsaw',
  })
  city: string;

  @ApiProperty({
    example: 'Marszałkowska 10, Warsaw',
  })
  address: string;

  @ApiProperty({
    example: 52.2297,
    nullable: true,
  })
  latitude: number | null;

  @ApiProperty({
    example: 21.0122,
    nullable: true,
  })
  longitude: number | null;

  @ApiProperty({
    example: 'ChIJAZ-GmmbMHkcR_NPqiCq-8HI',
    nullable: true,
  })
  placeId: string | null;

  @ApiProperty({
    enum: JobStatus,
    example: JobStatus.OPEN,
  })
  status: JobStatus;

  @ApiProperty({
    example: 'cm9client123abc456',
  })
  clientId: string;

  @ApiProperty({
    example: 'cm9worker123abc456',
    nullable: true,
  })
  assignedWorkerId: string | null;

  @ApiProperty({
    type: () => UserResponseDto,
  })
  client: UserResponseDto;

  @ApiProperty({
    type: () => UserResponseDto,
    nullable: true,
  })
  assignedWorker: UserResponseDto | null;

  @ApiProperty({
    example: '2026-03-30T12:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2026-03-30T12:30:00.000Z',
  })
  updatedAt: Date;
}
