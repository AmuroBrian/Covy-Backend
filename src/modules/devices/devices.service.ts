import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async registerDevice(
    currentUserId: string,
    platform?: string,
    model?: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    // Upsert a device record for the user (assuming 1 primary device for simplicity)
    const existingDevice = await this.prisma.device.findFirst({
      where: { userId: user.id },
    });

    if (existingDevice) {
      return this.prisma.device.update({
        where: { id: existingDevice.id },
        data: { platform, model, lastActive: new Date() },
      });
    }

    return this.prisma.device.create({
      data: {
        userId: user.id,
        platform,
        model,
      },
    });
  }

  async getPartnerDevice(currentUserId: string) {
    const user = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
      include: { couple: { include: { users: true } } },
    });

    if (!user || !user.couple) {
      return null;
    }

    const partner = user.couple.users.find((u) => u.id !== user.id);
    if (!partner) return null;

    return this.prisma.device.findFirst({
      where: { userId: partner.id },
      orderBy: { lastActive: 'desc' },
    });
  }
}
