import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class StatusesService {
  constructor(private readonly prisma: PrismaService) {}

  async createStatus(
    currentUserId: string,
    text: string,
    emoji?: string,
    expiresAt?: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
    });

    if (!user || !user.coupleId) {
      throw new BadRequestException('User is not in a couple.');
    }

    return this.prisma.status.create({
      data: {
        coupleId: user.coupleId,
        text,
        emoji,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });
  }

  async getStatuses(currentUserId: string) {
    const user = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
    });

    if (!user || !user.coupleId) {
      throw new BadRequestException('User is not in a couple.');
    }

    return this.prisma.status.findMany({
      where: {
        coupleId: user.coupleId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } } // Only active statuses
        ]
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
