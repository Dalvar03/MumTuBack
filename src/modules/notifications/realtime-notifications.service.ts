import { Injectable } from '@nestjs/common';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class RealtimeNotificationsService {
  constructor(private readonly gateway: NotificationsGateway) {}

  sendToUser(userId: string, notification: unknown) {
    this.gateway.emitToUser(userId, 'notification:new', notification);
  }
}
