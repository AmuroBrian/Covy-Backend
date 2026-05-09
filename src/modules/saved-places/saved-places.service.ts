import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SavedPlacesService {
  constructor(private readonly prisma: PrismaService) {}

  async createSavedPlace(currentUserId: string, label: string, lat: number, lng: number, radius: number) {
    const user = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
    });

    if (!user || !user.coupleId) {
      throw new BadRequestException('User is not in a couple.');
    }

    return this.prisma.savedPlace.create({
      data: {
        coupleId: user.coupleId,
        label,
        latitude: lat,
        longitude: lng,
        radius,
      },
    });
  }

  async getSavedPlaces(currentUserId: string) {
    const user = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
    });

    if (!user || !user.coupleId) {
      throw new BadRequestException('User is not in a couple.');
    }

    return this.prisma.savedPlace.findMany({
      where: { coupleId: user.coupleId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async deleteSavedPlace(currentUserId: string, placeId: string) {
    const user = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
    });

    if (!user || !user.coupleId) {
      throw new BadRequestException('User is not in a couple.');
    }

    const place = await this.prisma.savedPlace.findUnique({
      where: { id: placeId },
    });

    if (!place || place.coupleId !== user.coupleId) {
      throw new NotFoundException('Saved place not found.');
    }

    await this.prisma.savedPlace.delete({
      where: { id: placeId },
    });

    return { success: true, message: 'Saved place deleted.' };
  }
}
