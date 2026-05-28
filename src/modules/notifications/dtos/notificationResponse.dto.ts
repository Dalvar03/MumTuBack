import { ApiProperty } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';

export class NotificationResponseDto {
  @ApiProperty({
    example: 'cm123abc',
  })
  id!: string;

  @ApiProperty({
    enum: NotificationType,
    example: NotificationType.NEW_MESSAGE,
  })
  type!: NotificationType;

  @ApiProperty({
    example: 'New message',
  })
  title!: string;

  @ApiProperty({
    example: 'John sent you a message',
  })
  message!: string;

  @ApiProperty({
    example: false,
  })
  isRead!: boolean;

  @ApiProperty({
    example: 'job123',
    nullable: true,
  })
  jobId!: string | null;

  @ApiProperty({
    example: 'conversation123',
    nullable: true,
  })
  conversationId!: string | null;

  @ApiProperty({
    example: 'message123',
    nullable: true,
  })
  messageId!: string | null;

  @ApiProperty({
    example: '2026-05-28T10:00:00.000Z',
  })
  createdAt!: Date;
}
