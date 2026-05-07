import { Prisma } from '@prisma/client';
import {
  ConversationResponseDto,
  ConversationUserDto,
} from './dtos/conversation-response.dto';
import { MessageResponseDto } from './dtos/message-response.dto';

type MessageWithSender = Prisma.MessageGetPayload<{
  include: {
    sender: true;
  };
}>;

type ConversationWithRelations = Prisma.ConversationGetPayload<{
  include: {
    job: true;
    client: true;
    worker: true;
    messages: {
      include: {
        sender: true;
      };
    };
  };
}>;

export class ConversationsMapper {
  static toUserDto(user: {
    id: string;
    username: string | null;
    email: string;
    city: string | null;
    phoneNumber: string | null;
    averageRating: number | null;
    ratingsCount: number;
  }): ConversationUserDto {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      city: user.city,
      phoneNumber: user.phoneNumber,
      averageRating: user.averageRating,
      ratingsCount: user.ratingsCount,
    };
  }

  static toMessageDto(message: MessageWithSender): MessageResponseDto {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      text: message.text,
      readAt: message.readAt,
      createdAt: message.createdAt,
      sender: {
        id: message.sender.id,
        username: message.sender.username,
      },
    };
  }

  static toConversationDto(
    conversation: ConversationWithRelations,
    currentUserId: string,
  ): ConversationResponseDto {
    const unreadCount = conversation.messages.filter(
      (message) => message.senderId !== currentUserId && !message.readAt,
    ).length;

    return {
      id: conversation.id,
      jobId: conversation.jobId,
      clientId: conversation.clientId,
      workerId: conversation.workerId,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,

      job: {
        id: conversation.job.id,
        title: conversation.job.title,
        status: conversation.job.status,
      },

      client: this.toUserDto(conversation.client),
      worker: this.toUserDto(conversation.worker),

      lastMessage: conversation.messages[0]
        ? this.toMessageDto(conversation.messages[0])
        : null,

      unreadCount,
    };
  }
}
