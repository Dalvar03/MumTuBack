import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PrismaModule } from 'src/database/prisma/prisma.module';
import { NotificationsGateway } from './notifications.gateway';
import { RealtimeNotificationsService } from './realtime-notifications.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsGateway,
    RealtimeNotificationsService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
