import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SavedPlacesService {
  constructor(private readonly prisma: PrismaService) {}

  async createSavedPlace(currentUserId: string, label: string, lat: number, lng: number, radius: number, icon?: string, address?: string) {
    const user = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
    });

    if (!user || !user.coupleId) {
      throw new BadRequestException('User is not in a couple.');
    }

    return this.prisma.savedPlace.create({
      data: {
        coupleId: user.coupleId,
        userId: user.id,
        label,
        address,
        latitude: lat,
        longitude: lng,
        radius,
        icon,
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
      where: {
        coupleId: user.coupleId,
      },
      include: {
        user: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateSavedPlace(currentUserId: string, placeId: string, label?: string, icon?: string, address?: string) {
    const user = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
    });

    if (!user || !user.coupleId) {
      throw new BadRequestException('User is not in a couple.');
    }

    const place = await this.prisma.savedPlace.findFirst({
      where: { id: placeId, coupleId: user.coupleId },
    });

    if (!place) {
      throw new NotFoundException('Saved place not found or access denied.');
    }

    return this.prisma.savedPlace.update({
      where: { id: placeId },
      data: {
        ...(label && { label }),
        ...(icon && { icon }),
        ...(address !== undefined && { address }),
      },
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
