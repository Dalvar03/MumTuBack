import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { RealtimeNotificationsService } from './realtime-notifications.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeNotificationsService,
  ) {}

  async createNotification(params: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    jobId?: string;
    conversationId?: string;
    messageId?: string;
  }) {
    const notification = await this.prisma.notification.create({
      data: params,
    });

    this.realtime.sendToUser(params.userId, notification);

    return notification;
  }

  getMyNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  markAsRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: {
        isRead: true,
      },
    });
  }

  markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });
  }
}
