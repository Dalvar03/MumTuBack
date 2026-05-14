import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ConversationsGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('conversation:join')
  joinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ) {
    client.join(this.getConversationRoom(conversationId));

    return {
      success: true,
    };
  }

  @SubscribeMessage('conversation:leave')
  leaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ) {
    client.leave(this.getConversationRoom(conversationId));

    return {
      success: true,
    };
  }

  emitMessageCreated(conversationId: string) {
    this.server
      .to(this.getConversationRoom(conversationId))
      .emit('message:created', {
        conversationId,
      });
  }

  private getConversationRoom(conversationId: string) {
    return `conversation:${conversationId}`;
  }
}
