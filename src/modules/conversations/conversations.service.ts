import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'src/database/prisma/prisma.service';
import { SendMessageDto } from './dtos/send-message.dto';
import { ConversationsMapper } from './conversation.mapper';

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getCurrentUser(clerkUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async getConversationOrThrow(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        job: true,
        client: true,
        worker: true,
        messages: {
          include: {
            sender: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const isParticipant =
      conversation.clientId === userId || conversation.workerId === userId;

    if (!isParticipant) {
      throw new ForbiddenException(
        'You do not have access to this conversation',
      );
    }

    return conversation;
  }

  async getMyConversations(clerkUserId: string) {
    const user = await this.getCurrentUser(clerkUserId);

    const conversations = await this.prisma.conversation.findMany({
      where: {
        OR: [{ clientId: user.id }, { workerId: user.id }],
      },
      include: {
        job: true,
        client: true,
        worker: true,
        messages: {
          include: {
            sender: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return conversations.map((conversation) =>
      ConversationsMapper.toConversationDto(conversation, user.id),
    );
  }

  async getConversationById(clerkUserId: string, conversationId: string) {
    const user = await this.getCurrentUser(clerkUserId);

    const conversation = await this.getConversationOrThrow(
      conversationId,
      user.id,
    );

    return ConversationsMapper.toConversationDto(conversation, user.id);
  }

  async getMessages(clerkUserId: string, conversationId: string) {
    const user = await this.getCurrentUser(clerkUserId);

    await this.getConversationOrThrow(conversationId, user.id);

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
      },
      include: {
        sender: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return messages.map((message) => ConversationsMapper.toMessageDto(message));
  }

  async sendMessage(
    clerkUserId: string,
    conversationId: string,
    dto: SendMessageDto,
  ) {
    const user = await this.getCurrentUser(clerkUserId);

    await this.getConversationOrThrow(conversationId, user.id);

    const message = await this.prisma.$transaction(async (tx) => {
      const createdMessage = await tx.message.create({
        data: {
          conversationId,
          senderId: user.id,
          text: dto.text.trim(),
        },
        include: {
          sender: true,
        },
      });

      await tx.conversation.update({
        where: {
          id: conversationId,
        },
        data: {
          updatedAt: new Date(),
        },
      });

      return createdMessage;
    });

    return ConversationsMapper.toMessageDto(message);
  }

  async markAsRead(clerkUserId: string, conversationId: string) {
    const user = await this.getCurrentUser(clerkUserId);

    await this.getConversationOrThrow(conversationId, user.id);

    await this.prisma.message.updateMany({
      where: {
        conversationId,
        senderId: {
          not: user.id,
        },
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return {
      success: true,
    };
  }
}
