import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  controllers: [ConversationsController],
  providers: [ConversationsService],
  imports: [AuthModule],
})
export class ConversationsModule {}
