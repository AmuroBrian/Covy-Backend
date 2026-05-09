import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class CouplesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Connects two users using an invite code.
   */
  async connectPartner(currentUserId: string, inviteCode: string) {
    // 1. Get current user
    const currentUser = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
    });

    if (!currentUser) {
      throw new NotFoundException('Current user not found. Please sync first.');
    }

    if (currentUser.coupleId) {
      throw new BadRequestException('You are already in a couple.');
    }

    if (currentUser.inviteCode === inviteCode) {
      throw new BadRequestException('You cannot use your own invite code.');
    }

    // 2. Find partner by invite code
    const partner = await this.usersService.findByInviteCode(inviteCode);

    if (!partner) {
      throw new NotFoundException('Invalid invite code. Partner not found.');
    }

    if (partner.coupleId) {
      throw new BadRequestException('This partner is already in a couple.');
    }

    // 3. Create Couple record and update both users
    const couple = await this.prisma.couple.create({
      data: {
        status: 'ACTIVE',
        users: {
          connect: [{ id: currentUser.id }, { id: partner.id }],
        },
      },
      include: {
        users: true,
      },
    });

    return couple;
  }

  /**
   * Disconnects the current user from their couple.
   */
  async disconnectPartner(currentUserId: string) {
    const currentUser = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
      include: { couple: true },
    });

    if (!currentUser || !currentUser.coupleId) {
      throw new BadRequestException('You are not currently in a couple.');
    }

    // Mark the couple as disconnected
    await this.prisma.couple.update({
      where: { id: currentUser.coupleId },
      data: {
        status: 'DISCONNECTED',
        disconnectedAt: new Date(),
      },
    });

    // Remove coupleId from both users to fully detatch them
    // Keeping the historical Couple record for data integrity
    await this.prisma.user.updateMany({
      where: { coupleId: currentUser.coupleId },
      data: { coupleId: null },
    });

    return { message: 'Successfully disconnected from partner.' };
  }
}
