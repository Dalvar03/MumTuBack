import { ApiProperty } from '@nestjs/swagger';
import { MessageResponseDto } from './message-response.dto';

export class ConversationUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true, type: 'string' })
  username!: string | null;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true, type: 'string' })
  city!: string | null;

  @ApiProperty({ nullable: true, type: 'string' })
  phoneNumber!: string | null;

  @ApiProperty({ nullable: true, type: 'number' })
  averageRating!: number | null;

  @ApiProperty()
  ratingsCount!: number;
}

export class ConversationJobDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  status!: string;
}

export class ConversationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  jobId!: string;

  @ApiProperty()
  clientId!: string;

  @ApiProperty()
  workerId!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({
    type: ConversationJobDto,
  })
  job!: ConversationJobDto;

  @ApiProperty({
    type: ConversationUserDto,
  })
  client!: ConversationUserDto;

  @ApiProperty({
    type: ConversationUserDto,
  })
  worker!: ConversationUserDto;

  @ApiProperty({
    type: MessageResponseDto,
    nullable: true,
  })
  lastMessage!: MessageResponseDto | null;

  @ApiProperty()
  unreadCount!: number;
}
