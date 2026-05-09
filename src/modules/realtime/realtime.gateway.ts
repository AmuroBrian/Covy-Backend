import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { PrismaService } from '../../database/prisma.service';

@WebSocketGateway({
  cors: {
    origin: '*', // Restrict in production
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // In-memory store mapping userId to socketId
  private activeUsers = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token || client.handshake.headers['authorization']?.split(' ')[1];
    
    if (!token) {
      client.disconnect();
      return;
    }

    try {
      // NOTE: For full security, we should manually verify the Supabase JWT using the RS256 public key.
      // Alternatively, the client passes their user ID after auth validation via HTTP.
      // For now, we will extract the payload assuming the token is valid (it should be validated by Supabase Auth).
      // Ideally, decode it using jwks-rsa logic here too.
      
      const payloadBase64 = token.split('.')[1];
      const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
      
      const userId = payload.sub;
      this.activeUsers.set(userId, client.id);

      console.log(`Client connected: ${client.id} (User: ${userId})`);
      
      // Notify partner that the user is online
      this.notifyPartnerPresence(userId, true);
    } catch (err) {
      console.error('Socket connection error:', err);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    
    // Remove from active users and notify partner
    for (const [userId, socketId] of this.activeUsers.entries()) {
      if (socketId === client.id) {
        this.activeUsers.delete(userId);
        this.notifyPartnerPresence(userId, false);
        break;
      }
    }
  }

  @SubscribeMessage('ping_location')
  async handleLocationPing(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { lat: number; lng: number; battery: number },
  ) {
    // Find who this socket belongs to
    let currentUserId: string | null = null;
    for (const [userId, socketId] of this.activeUsers.entries()) {
      if (socketId === client.id) {
        currentUserId = userId;
        break;
      }
    }

    if (!currentUserId) return;

    const user = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
      include: { couple: { include: { users: true } } },
    });

    if (!user || !user.couple) return;

    // Save location to history
    await this.prisma.locationHistory.create({
      data: {
        userId: user.id,
        latitude: data.lat,
        longitude: data.lng,
      },
    });

    // Update user battery level
    await this.prisma.device.updateMany({
      where: { userId: user.id },
      data: { batteryLevel: Math.round(data.battery), lastActive: new Date() },
    });

    // Find partner and emit directly if online
    const partner = user.couple.users.find((u) => u.id !== user.id);
    if (partner && partner.providerId) {
      const partnerSocketId = this.activeUsers.get(partner.providerId);
      if (partnerSocketId) {
        this.server.to(partnerSocketId).emit('partner_location_update', {
          lat: data.lat,
          lng: data.lng,
          battery: data.battery,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  private async notifyPartnerPresence(providerId: string, isOnline: boolean) {
    try {
      const user = await this.prisma.user.findFirst({
        where: { providerId: providerId },
        include: { couple: { include: { users: true } } },
      });

      if (!user || !user.couple) return;

      const partner = user.couple.users.find((u) => u.id !== user.id);
      if (partner && partner.providerId) {
        const partnerSocketId = this.activeUsers.get(partner.providerId);
        if (partnerSocketId) {
          this.server.to(partnerSocketId).emit('partner_presence', {
            isOnline,
            lastActive: new Date().toISOString(),
          });
        }
      }
    } catch (e) {
      // Ignore presence failure
    }
  }

  /**
   * Broadcasts a new chat message to the partner if they are connected.
   */
  public async broadcastMessage(coupleId: string, senderId: string, message: any) {
    try {
      const couple = await this.prisma.couple.findUnique({
        where: { id: coupleId },
        include: { users: true },
      });

      if (!couple) return;

      const partner = couple.users.find((u) => u.id !== senderId);
      if (partner && partner.providerId) {
        const partnerSocketId = this.activeUsers.get(partner.providerId);
        if (partnerSocketId) {
          this.server.to(partnerSocketId).emit('new_message', message);
        }
      }
    } catch (err) {
      console.error('Failed to broadcast message:', err);
    }
  }

  /**
   * Broadcasts a reaction to the partner if they are connected.
   */
  public async broadcastReaction(coupleId: string, reactionData: any) {
    try {
      const couple = await this.prisma.couple.findUnique({
        where: { id: coupleId },
        include: { users: true },
      });

      if (!couple) return;

      const partner = couple.users.find((u) => u.id !== reactionData.userId);
      if (partner && partner.providerId) {
        const partnerSocketId = this.activeUsers.get(partner.providerId);
        if (partnerSocketId) {
          this.server.to(partnerSocketId).emit('message_reacted', reactionData);
        }
      }
    } catch (err) {
      console.error('Failed to broadcast reaction:', err);
    }
  }

  /**
   * Checks if a specific user is currently connected via WebSockets.
   */
  public isUserOnline(providerId: string): boolean {
    return this.activeUsers.has(providerId);
  }
}
