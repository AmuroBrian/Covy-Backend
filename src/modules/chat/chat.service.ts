import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  /**
   * Retrieves paginated messages for a couple.
   */
  async getMessages(currentUserId: string, cursor?: string, limit: number = 50) {
    const user = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
    });

    if (!user || !user.coupleId) {
      throw new BadRequestException('User is not in a couple.');
    }

    const messages = await this.prisma.message.findMany({
      where: { coupleId: user.coupleId },
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' }, // Latest first
    });

    return messages;
  }

  /**
   * Sends a new message and broadcasts it.
   */
  async sendMessage(
    currentUserId: string,
    content: string,
    mediaUrl?: string,
    type: 'TEXT' | 'IMAGE' | 'AUDIO' = 'TEXT',
  ) {
    const user = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
    });

    if (!user || !user.coupleId) {
      throw new BadRequestException('User is not in a couple.');
    }

    const message = await this.prisma.message.create({
      data: {
        coupleId: user.coupleId,
        senderId: user.id,
        content,
        mediaUrl,
        type,
      },
    });

    // Broadcast the message immediately via WebSockets
    this.realtimeGateway.broadcastMessage(user.coupleId, user.id, message);

    return message;
  }

  /**
   * Marks all unread messages from the partner as read.
   */
  async markAsRead(currentUserId: string) {
    const user = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
      include: { couple: { include: { users: true } } },
    });

    if (!user || !user.couple || !user.coupleId) {
      throw new BadRequestException('User is not in a couple.');
    }

    const partner = user.couple.users.find((u) => u.id !== user.id);
    if (!partner) return { updatedCount: 0 };

    const result = await this.prisma.message.updateMany({
      where: {
        coupleId: user.coupleId,
        senderId: partner.id,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return { updatedCount: result.count };
  }
}
