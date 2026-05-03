import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({
    example: 'a3f5c9d2-1234-4b8a-9c2a-abcdef123456',
    description: 'Unique user identifier (UUID)',
  })
  id!: string;

  @ApiProperty({
    example: 'user_2Yx123abcClerkId',
    description: 'Clerk user ID',
  })
  clerkUserId!: string;

  @ApiProperty({
    example: 'john@example.com',
    description: 'User email address',
  })
  email!: string;

  @ApiProperty({
    example: 'CLIENT',
    enum: ['CLIENT', 'WORKER'],
    nullable: true,
    description: 'User role (can be null before onboarding)',
  })
  role!: 'CLIENT' | 'WORKER' | null;

  @ApiProperty({
    example: 'john_doe',
    nullable: true,
    description: 'Username (set during onboarding)',
  })
  username!: string | null;

  @ApiProperty({
    example: 'Warsaw',
    nullable: true,
    description: 'User city',
  })
  city!: string | null;

  @ApiProperty({
    example: 25,
    nullable: true,
    description: 'Work radius in kilometers',
  })
  workRadiusKm!: number | null;

  @ApiProperty({
    example: true,
    description: 'Indicates whether onboarding is completed',
  })
  onboardingDone!: boolean;

  @ApiProperty({
    example: '2026-03-30T10:15:30.000Z',
    description: 'User creation timestamp (ISO string)',
  })
  createdAt!: Date;

  @ApiProperty({
    example: '2026-03-30T10:15:30.000Z',
    description: 'Last update timestamp (ISO string)',
  })
  updatedAt!: Date;

  @ApiProperty({
    example: 'IBAN: PL Name: Lukash Lukash',
    description: 'Worker Payment details',
  })
  paymentDetails?: string;

  @ApiProperty({
    example: '+380123123123',
    description: 'phone number',
  })
  phoneNumber?: string;
}
