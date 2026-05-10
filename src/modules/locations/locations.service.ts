import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves the absolute latest location of the partner.
   * Used for initial app load before the WebSocket takes over.
   */
  async getLatestPartnerLocation(currentUserId: string) {
    const user = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
      include: { couple: { include: { users: true } } },
    });

    if (!user || !user.couple) {
      throw new BadRequestException('User is not in a couple.');
    }

    const partner = user.couple.users.find((u) => u.id !== user.id);
    if (!partner) return null;

    const latestLocation = await this.prisma.locationHistory.findFirst({
      where: { userId: partner.id },
      orderBy: { timestamp: 'desc' },
    });

    const partnerDevice = await this.prisma.device.findFirst({
      where: { userId: partner.id },
      orderBy: { lastActive: 'desc' }
    });

    if (!latestLocation) return null;

    return {
      ...latestLocation,
      speed: latestLocation.speed,
      battery: partnerDevice?.batteryLevel ?? null,
      isCharging: partnerDevice?.isCharging ?? false,
    };
  }

  /**
   * Retrieves paginated location history for the partner.
   */
  async getPartnerLocationHistory(currentUserId: string, limit: number = 100, cursor?: string) {
    const user = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
      include: { couple: { include: { users: true } } },
    });

    if (!user || !user.couple) {
      throw new BadRequestException('User is not in a couple.');
    }

    const partner = user.couple.users.find((u) => u.id !== user.id);
    if (!partner) return [];

    const history = await this.prisma.locationHistory.findMany({
      where: { userId: partner.id },
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { timestamp: 'desc' },
    });

    return history;
  }
}
