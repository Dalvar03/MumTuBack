import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { AuthModule } from '../auth/auth.module';
import { S3Module } from 'src/common/s3/s3.module';
import { ConversationsGateway } from './conversation.gateway';

@Module({
  controllers: [ConversationsController],
  providers: [ConversationsService, ConversationsGateway],
  imports: [AuthModule, S3Module],
})
export class ConversationsModule {}
