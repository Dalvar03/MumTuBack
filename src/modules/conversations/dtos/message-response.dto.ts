import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MessageSenderDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true, type: 'string' })
  username!: string | null;
}

export class MessageResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  conversationId!: string;

  @ApiProperty()
  senderId!: string;

  @ApiProperty()
  text!: string;

  @ApiPropertyOptional()
  imageUrl?: string | null;

  @ApiProperty({ nullable: true })
  readAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({
    type: MessageSenderDto,
  })
  sender!: MessageSenderDto;
}
