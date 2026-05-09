import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async createGoal(
    currentUserId: string,
    title: string,
    description?: string,
    targetDate?: string,
    targetAmount?: number,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
    });

    if (!user || !user.coupleId) {
      throw new BadRequestException('User is not in a couple.');
    }

    const goal = await this.prisma.goal.create({
      data: {
        coupleId: user.coupleId,
        title,
        description,
        targetDate: targetDate ? new Date(targetDate) : null,
        targetAmount,
      },
    });
    this.realtime.broadcastSharedUpdate(user.coupleId);
    return goal;
  }

  async getGoals(currentUserId: string) {
    const user = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
    });

    if (!user || !user.coupleId) {
      throw new BadRequestException('User is not in a couple.');
    }

    return this.prisma.goal.findMany({
      where: { coupleId: user.coupleId },
      orderBy: [
        { isCompleted: 'asc' }, // Pending goals first
        { targetDate: 'asc' },  // Soonest goals first
      ],
    });
  }

  async updateGoal(
    currentUserId: string,
    goalId: string,
    title?: string,
    description?: string,
    isCompleted?: boolean,
    targetDate?: string,
    progress?: number,
    targetAmount?: number,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
    });

    if (!user || !user.coupleId) {
      throw new BadRequestException('User is not in a couple.');
    }

    const goal = await this.prisma.goal.findUnique({
      where: { id: goalId },
    });

    if (!goal || goal.coupleId !== user.coupleId) {
      throw new NotFoundException('Goal not found.');
    }

    const updated = await this.prisma.goal.update({
      where: { id: goalId },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(isCompleted !== undefined && { isCompleted }),
        ...(targetDate !== undefined && { targetDate: targetDate ? new Date(targetDate) : null }),
        ...(progress !== undefined && { progress }),
        ...(targetAmount !== undefined && { targetAmount }),
      },
    });
    this.realtime.broadcastSharedUpdate(user.coupleId);
    return updated;
  }

  async deleteGoal(currentUserId: string, goalId: string) {
    const user = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
    });

    if (!user || !user.coupleId) {
      throw new BadRequestException('User is not in a couple.');
    }

    const goal = await this.prisma.goal.findUnique({
      where: { id: goalId },
    });

    if (!goal || goal.coupleId !== user.coupleId) {
      throw new NotFoundException('Goal not found.');
    }

    await this.prisma.goal.delete({
      where: { id: goalId },
    });

    this.realtime.broadcastSharedUpdate(user.coupleId);
    return { success: true, message: 'Goal deleted.' };
  }
}
