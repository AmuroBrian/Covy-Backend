import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly notificationsService: NotificationsService,
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
      include: {
        reactions: true,
        replyTo: true,
      },
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
    replyToId?: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
      include: { couple: { include: { users: true } } },
    });

    if (!user || !user.couple || !user.coupleId) {
      throw new BadRequestException('User is not in a couple.');
    }

    const message = await this.prisma.message.create({
      data: {
        coupleId: user.coupleId,
        senderId: user.id,
        content,
        mediaUrl,
        type,
        replyToId,
      },
      include: {
        replyTo: true,
      }
    });

    // Broadcast the message immediately via WebSockets
    this.realtimeGateway.broadcastMessage(user.coupleId, user.id, message);

    // If partner is offline, send a push notification
    const partner = user.couple.users.find((u) => u.id !== user.id);
    if (partner && partner.providerId) {
      const isOnline = this.realtimeGateway.isUserOnline(partner.providerId);
      if (!isOnline) {
        let notifBody = content;
        if (type === 'IMAGE') notifBody = '📷 Sent a photo';
        if (type === 'AUDIO') notifBody = '🎤 Sent a voice message';
        
        await this.notificationsService.sendPushNotification(
          partner.providerId,
          `${user.displayName || 'Your partner'} sent a message`,
          notifBody,
          { type: 'NEW_MESSAGE', messageId: message.id }
        );
      }
    }

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

  /**
   * Adds or updates a reaction on a message.
   */
  async addReaction(currentUserId: string, messageId: string, emoji: string) {
    const user = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
    });

    if (!user || !user.coupleId) {
      throw new BadRequestException('User is not in a couple.');
    }

    const message = await this.prisma.message.findFirst({
      where: { id: messageId, coupleId: user.coupleId },
    });

    if (!message) {
      throw new NotFoundException('Message not found.');
    }

    const existingReaction = await this.prisma.messageReaction.findUnique({
      where: {
        messageId_userId: { messageId: messageId, userId: user.id },
      },
    });

    if (existingReaction && existingReaction.emoji === emoji) {
      // User tapped the same emoji -> Remove reaction
      await this.prisma.messageReaction.delete({
        where: { id: existingReaction.id },
      });
      
      this.realtimeGateway.broadcastReaction(user.coupleId, {
        messageId,
        userId: user.id,
        emoji: null, // Indicates removal
      });
      return { removed: true };
    }

    // Upsert the reaction
    const reaction = await this.prisma.messageReaction.upsert({
      where: {
        messageId_userId: {
          messageId: messageId,
          userId: user.id,
        },
      },
      update: { emoji },
      create: {
        messageId,
        userId: user.id,
        emoji,
      },
    });

    // Broadcast the reaction
    this.realtimeGateway.broadcastReaction(user.coupleId, {
      messageId,
      userId: user.id,
      emoji,
      createdAt: reaction.createdAt.toISOString(),
    });

    return reaction;
  }

  /**
   * Hard deletes a message if the user owns it.
   */
  async deleteMessage(currentUserId: string, messageId: string) {
    const user = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
    });

    if (!user || !user.coupleId) {
      throw new BadRequestException('User is not in a couple.');
    }

    const message = await this.prisma.message.findFirst({
      where: { id: messageId, coupleId: user.coupleId },
    });

    if (!message) {
      throw new NotFoundException('Message not found.');
    }

    if (message.senderId !== user.id) {
      throw new BadRequestException('You can only delete your own messages.');
    }

    // Hard delete the message (cascades reactions)
    await this.prisma.message.delete({
      where: { id: messageId },
    });

    // Broadcast the deletion
    this.realtimeGateway.broadcastMessageDeleted(user.coupleId, messageId);

    return { deleted: true, messageId };
  }
}
