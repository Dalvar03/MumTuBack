import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class NotificationsGateway {
  @WebSocketServer()
  server!: Server;

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  handleConnection(client: Socket) {
    const auth = client.handshake.auth as { userId?: unknown };

    const userId = auth.userId;

    if (typeof userId !== 'string') {
      client.disconnect();
      return;
    }

    void client.join(`user:${userId}`);
  }
}
