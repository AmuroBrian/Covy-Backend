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
import { NotificationsService } from '../notifications/notifications.service';
import { PetService } from '../pet/pet.service';

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly petService: PetService,
  ) {}

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
      
      // Immediately notify the newly connected user about their partner's status
      this.sendPartnerPresenceToUser(userId, client.id);
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
    @MessageBody() data: { lat: number; lng: number; battery: number; isCharging: boolean; speed?: number },
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

    if (!user || !user.couple || !user.coupleId) return;

    // Fetch previous state for notification triggers
    const oldDevice = await this.prisma.device.findFirst({
      where: { userId: user.id },
      orderBy: { lastActive: 'desc' }
    });

    const oldLocation = await this.prisma.locationHistory.findFirst({
      where: { userId: user.id },
      orderBy: { timestamp: 'desc' }
    });

    // Save location to history
    await this.prisma.locationHistory.create({
      data: {
        userId: user.id,
        latitude: data.lat,
        longitude: data.lng,
        speed: data.speed,
      },
    });

    // Update user battery level and charging status
    await this.prisma.device.updateMany({
      where: { userId: user.id },
      data: { batteryLevel: Math.round(data.battery), isCharging: data.isCharging, lastActive: new Date() },
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
          isCharging: data.isCharging,
          speed: data.speed,
          timestamp: new Date().toISOString(),
        });
      }

      // --- PUSH NOTIFICATION TRIGGERS ---
      const partnerName = user.displayName || 'Your partner';

      // 1. Battery Alerts
      if (oldDevice) {
        if (data.battery <= 20 && (oldDevice.batteryLevel || 100) > 20 && !data.isCharging) {
          await this.notificationsService.sendPushNotification(partner.providerId, `Battery Low`, `${partnerName}'s battery is running low (${Math.round(data.battery)}%)`);
        }
        if (data.isCharging && !oldDevice.isCharging) {
          await this.notificationsService.sendPushNotification(partner.providerId, `Charging Started`, `${partnerName} plugged in their device! (${Math.round(data.battery)}%)`);
        }
        if (data.battery >= 100 && (oldDevice.batteryLevel || 0) < 100) {
          await this.notificationsService.sendPushNotification(partner.providerId, `Fully Charged`, `${partnerName}'s device is fully charged (100%)`);
        }
      }

      // 2. Activity (Speed) Alerts
      if (data.speed !== undefined && oldLocation) {
        const prevSpeed = oldLocation.speed || 0;
        if (data.speed >= 6.5 && prevSpeed < 6.5) {
          await this.notificationsService.sendPushNotification(partner.providerId, `Driving`, `${partnerName} is now Driving`);
        }
      }

      // 3. Geofencing Alerts
      const getDistanceFromLatLonInM = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371e3; // Radius of the earth in m
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a = 
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; 
      };

      const savedPlaces = await this.prisma.savedPlace.findMany({
        where: { coupleId: user.coupleId }
      });

      for (const place of savedPlaces) {
        const newDist = getDistanceFromLatLonInM(data.lat, data.lng, place.latitude, place.longitude);
        const oldDist = oldLocation ? getDistanceFromLatLonInM(oldLocation.latitude, oldLocation.longitude, place.latitude, place.longitude) : null;
        
        const radius = place.radius || 200;

        if (oldDist !== null) {
          if (newDist <= radius && oldDist > radius) {
            await this.notificationsService.sendPushNotification(partner.providerId, `Arrived`, `${partnerName} arrived at ${place.label}`);
          } else if (newDist > radius && oldDist <= radius) {
            await this.notificationsService.sendPushNotification(partner.providerId, `Departed`, `${partnerName} left ${place.label}`);
          }
        }
      }
    }
  }

  @SubscribeMessage('send_nudge')
  async handleSendNudge(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { emoji: string },
  ) {
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

    if (!user || !user.couple || !user.coupleId) return;

    const partner = user.couple.users.find((u) => u.id !== user.id);
    if (partner && partner.providerId) {
      const partnerSocketId = this.activeUsers.get(partner.providerId);
      if (partnerSocketId) {
        this.server.to(partnerSocketId).emit('receive_nudge', {
          emoji: data.emoji || '❤️',
          senderId: user.id,
          timestamp: new Date().toISOString(),
        });
      }
      
      // Send Nudge Push Notification
      const partnerName = user.displayName || 'Your partner';
      await this.notificationsService.sendPushNotification(
        partner.providerId,
        `${partnerName} nudged you!`,
        `${partnerName} sent you a ${data.emoji || '❤️'} nudge!`
      );
    }
  }

  private async notifyPartnerPresence(providerId: string, isOnline: boolean) {
    try {
      const user = await this.prisma.user.findFirst({
        where: { providerId: providerId },
        include: { couple: { include: { users: true } } },
      });

      if (!user || !user.couple || !user.coupleId) return;

      const partner = user.couple.users.find((u) => u.id !== user.id);
      if (partner && partner.providerId) {
        const partnerSocketId = this.activeUsers.get(partner.providerId);
        if (partnerSocketId) {
          let lastActive = new Date();
          
          if (!isOnline) {
            // Update device's last active if disconnecting
            await this.prisma.device.updateMany({
              where: { userId: user.id },
              data: { lastActive: lastActive }
            });
          }

          this.server.to(partnerSocketId).emit('partner_presence', {
            isOnline,
            lastActive: lastActive.toISOString(),
          });
        }
      }
    } catch (e) {
      // Ignore presence failure
    }
  }

  // --- PET INTERACTIONS ---

  @SubscribeMessage('get_pet_state')
  async handleGetPetState(@ConnectedSocket() client: Socket) {
    const user = await this.getUserFromClient(client);
    if (!user || !user.coupleId) return;

    const petState = await this.petService.getPetState(user.coupleId);
    client.emit('pet_state_update', petState);
  }

  @SubscribeMessage('feed_pet')
  async handleFeedPet(@ConnectedSocket() client: Socket) {
    const user = await this.getUserFromClient(client);
    if (!user || !user.coupleId) return;

    const petState = await this.petService.feedPet(user.coupleId);
    this.broadcastPetState(user.coupleId, petState);
  }

  @SubscribeMessage('pat_pet')
  async handlePatPet(@ConnectedSocket() client: Socket) {
    const user = await this.getUserFromClient(client);
    if (!user || !user.coupleId) return;

    const petState = await this.petService.patPet(user.coupleId);
    this.broadcastPetState(user.coupleId, petState);
  }

  @SubscribeMessage('toggle_pet_sleep')
  async handleTogglePetSleep(@ConnectedSocket() client: Socket) {
    const user = await this.getUserFromClient(client);
    if (!user || !user.coupleId) return;

    const petState = await this.petService.toggleSleep(user.coupleId);
    this.broadcastPetState(user.coupleId, petState);
  }

  private async broadcastPetState(coupleId: string, petState: any) {
    const couple = await this.prisma.couple.findUnique({
      where: { id: coupleId },
      include: { users: true }
    });
    
    if (!couple) return;

    couple.users.forEach(u => {
      if (u.providerId) {
        const socketId = this.activeUsers.get(u.providerId);
        if (socketId) {
          this.server.to(socketId).emit('pet_state_update', petState);
        }
      }
    });
  }

  private async getUserFromClient(client: Socket) {
    let currentUserId: string | null = null;
    for (const [userId, socketId] of this.activeUsers.entries()) {
      if (socketId === client.id) {
        currentUserId = userId;
        break;
      }
    }
    if (!currentUserId) return null;
    return await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
    });
  }

  private async sendPartnerPresenceToUser(providerId: string, socketId: string) {
    try {
      const user = await this.prisma.user.findFirst({
        where: { providerId },
        include: { couple: { include: { users: true } } },
      });

      if (!user || !user.couple || !user.coupleId) return;

      const partner = user.couple.users.find((u) => u.id !== user.id);
      if (partner && partner.providerId) {
        const isPartnerOnline = this.activeUsers.has(partner.providerId);
        
        // Find partner's last active time from device
        const partnerDevice = await this.prisma.device.findFirst({
          where: { userId: partner.id },
          orderBy: { lastActive: 'desc' }
        });

        this.server.to(socketId).emit('partner_presence', {
          isOnline: isPartnerOnline,
          lastActive: partnerDevice?.lastActive ? partnerDevice.lastActive.toISOString() : new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error('Failed to send partner presence', e);
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

  /**
   * Broadcasts a message deletion.
   */
  public async broadcastMessageDeleted(coupleId: string, messageId: string) {
    try {
      const couple = await this.prisma.couple.findUnique({
        where: { id: coupleId },
        include: { users: true },
      });

      if (!couple) return;

      // Broadcast to all connected users in the couple
      for (const u of couple.users) {
        if (u.providerId) {
          const socketId = this.activeUsers.get(u.providerId);
          if (socketId) {
            this.server.to(socketId).emit('message_deleted', { messageId });
          }
        }
      }
    } catch (err) {
      console.error('Failed to broadcast message deletion:', err);
    }
  }

  /**
   * Broadcasts a generic update event for Shared Space (Checklists, Goals, Finance).
   */
  public async broadcastSharedUpdate(coupleId: string) {
    try {
      const couple = await this.prisma.couple.findUnique({
        where: { id: coupleId },
        include: { users: true },
      });

      if (!couple) return;

      for (const u of couple.users) {
        if (u.providerId) {
          const socketId = this.activeUsers.get(u.providerId);
          if (socketId) {
            this.server.to(socketId).emit('shared_space_update', { timestamp: new Date().toISOString() });
          }
        }
      }
    } catch (err) {
      console.error('Failed to broadcast shared space update:', err);
    }
  }
}
