import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'src/database/prisma/prisma.service';
import { SendMessageDto } from './dtos/send-message.dto';
import { ConversationsMapper } from './conversation.mapper';
import { S3Service } from 'src/common/s3/s3.service';
import { ConversationsGateway } from './conversation.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly conversationsGateway: ConversationsGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

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
    image?: Express.Multer.File,
  ) {
    const user = await this.getCurrentUser(clerkUserId);

    const conversation = await this.getConversationOrThrow(
      conversationId,
      user.id,
    );

    const text = dto.text?.trim();

    if (!text && !image) {
      throw new BadRequestException('Message text or image is required');
    }

    let imageUrl: string | null = null;

    if (image) {
      imageUrl = (
        await this.s3Service.uploadFile(
          image,
          `conversations/${conversationId}`,
        )
      ).url;
    }

    const message = await this.prisma.$transaction(async (tx) => {
      const createdMessage = await tx.message.create({
        data: {
          conversationId,
          senderId: user.id,
          text: text || '',
          imageUrl,
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

    this.conversationsGateway.emitMessageCreated(conversationId);

    const recipientId =
      conversation.clientId === user.id
        ? conversation.workerId
        : conversation.clientId;

    if (recipientId && recipientId !== user.id) {
      void this.notificationsService.createNotification({
        userId: recipientId,
        type: NotificationType.NEW_MESSAGE,
        title: 'New message',
        message: `${user.username ?? 'User'} sent you a message`,
        conversationId: conversation.id,
        messageId: message.id,
        jobId: conversation.jobId,
      });
    }

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
