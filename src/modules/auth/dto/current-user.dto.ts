import { ApiProperty } from '@nestjs/swagger';

export class CurrentUserResponseDto {
  @ApiProperty({
    example: 'a3f5c9d2-1234-4b8a-9c2a-abcdef123456',
    description: 'Unique user identifier (UUID)',
  })
  id: string;

  @ApiProperty({
    example: 'user_2Yx123abcClerkId',
    description: 'Clerk user ID',
  })
  clerkUserId: string;

  @ApiProperty({
    example: 'john@example.com',
    description: 'User email address',
  })
  email: string;

  @ApiProperty({
    example: 'CLIENT',
    enum: ['CLIENT', 'WORKER'],
    nullable: true,
    description: 'User role (can be null before onboarding)',
  })
  role: 'CLIENT' | 'WORKER' | null;

  @ApiProperty({
    example: 'john_doe',
    nullable: true,
    description: 'Username (set during onboarding)',
  })
  username: string | null;

  @ApiProperty({
    example: 'ACTIVE',
    nullable: true,
    description: 'Status of authenticated user',
    enum: ['ACTIVE', 'BLOCKED'],
  })
  status: 'ACTIVE' | 'BLOCKED';
}
