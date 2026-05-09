import { Controller, Post, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';

@Controller('notifications')
@UseGuards(ApiKeyGuard, JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Endpoint to manually trigger a notification to the partner.
   * Useful for "Send a nudge" features.
   */
  @Post('nudge')
  async sendNudge(@CurrentUser() user: any, @Body('message') message?: string) {
    const dbUser = await this.prisma.user.findFirst({
      where: { providerId: user.userId },
      include: { couple: { include: { users: true } } },
    });

    if (!dbUser || !dbUser.couple) {
      throw new BadRequestException('You are not in a couple.');
    }

    const partner = dbUser.couple.users.find((u) => u.id !== dbUser.id);
    if (!partner) {
      throw new BadRequestException('Partner not found.');
    }

    const title = 'New Nudge! ✨';
    const body = message || `${dbUser.displayName || 'Your partner'} is thinking about you.`;

    if (partner.providerId) {
      await this.notificationsService.sendPushNotification(partner.providerId, title, body, {
        type: 'NUDGE',
        senderId: dbUser.id,
      });
    }

    return { success: true, message: 'Nudge sent successfully.' };
  }
}
