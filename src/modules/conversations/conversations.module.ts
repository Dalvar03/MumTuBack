import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { AuthModule } from '../auth/auth.module';
import { S3Module } from 'src/common/s3/s3.module';
import { ConversationsGateway } from './conversation.gateway';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  controllers: [ConversationsController],
  providers: [ConversationsService, ConversationsGateway],
  imports: [AuthModule, S3Module, NotificationsModule],
})
export class ConversationsModule {}
