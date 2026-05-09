import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ChecklistsService {
  constructor(private readonly prisma: PrismaService) {}

  async createChecklist(currentUserId: string, title: string) {
    const user = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
    });

    if (!user || !user.coupleId) {
      throw new BadRequestException('User is not in a couple.');
    }

    return this.prisma.checklist.create({
      data: {
        coupleId: user.coupleId,
        title,
      },
      include: { items: true },
    });
  }

  async getChecklists(currentUserId: string) {
    const user = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
    });

    if (!user || !user.coupleId) {
      throw new BadRequestException('User is not in a couple.');
    }

    return this.prisma.checklist.findMany({
      where: { coupleId: user.coupleId },
      include: {
        items: {
          orderBy: { dueDate: 'asc' },
          include: { assignee: { select: { id: true, displayName: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteChecklist(currentUserId: string, checklistId: string) {
    const user = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
    });

    if (!user || !user.coupleId) {
      throw new BadRequestException('User is not in a couple.');
    }

    const checklist = await this.prisma.checklist.findUnique({
      where: { id: checklistId },
    });

    if (!checklist || checklist.coupleId !== user.coupleId) {
      throw new NotFoundException('Checklist not found.');
    }

    // Prisma doesn't natively cascade deletes unless defined in schema, but we can delete items first
    await this.prisma.checklistItem.deleteMany({
      where: { checklistId },
    });

    await this.prisma.checklist.delete({
      where: { id: checklistId },
    });

    return { success: true, message: 'Checklist deleted.' };
  }

  async addChecklistItem(
    currentUserId: string,
    checklistId: string,
    title: string,
    assignedToId?: string,
    dueDate?: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
    });

    if (!user || !user.coupleId) {
      throw new BadRequestException('User is not in a couple.');
    }

    const checklist = await this.prisma.checklist.findUnique({
      where: { id: checklistId },
    });

    if (!checklist || checklist.coupleId !== user.coupleId) {
      throw new NotFoundException('Checklist not found.');
    }

    return this.prisma.checklistItem.create({
      data: {
        checklistId,
        title,
        assignedToId,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    });
  }

  async updateChecklistItem(
    currentUserId: string,
    itemId: string,
    isCompleted?: boolean,
    title?: string,
    assignedToId?: string,
    dueDate?: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
    });

    if (!user || !user.coupleId) {
      throw new BadRequestException('User is not in a couple.');
    }

    const item = await this.prisma.checklistItem.findUnique({
      where: { id: itemId },
      include: { checklist: true },
    });

    if (!item || item.checklist.coupleId !== user.coupleId) {
      throw new NotFoundException('Checklist item not found.');
    }

    return this.prisma.checklistItem.update({
      where: { id: itemId },
      data: {
        ...(title !== undefined && { title }),
        ...(isCompleted !== undefined && { isCompleted }),
        ...(assignedToId !== undefined && { assignedToId }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      },
    });
  }

  async deleteChecklistItem(currentUserId: string, itemId: string) {
    const user = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
    });

    if (!user || !user.coupleId) {
      throw new BadRequestException('User is not in a couple.');
    }

    const item = await this.prisma.checklistItem.findUnique({
      where: { id: itemId },
      include: { checklist: true },
    });

    if (!item || item.checklist.coupleId !== user.coupleId) {
      throw new NotFoundException('Checklist item not found.');
    }

    await this.prisma.checklistItem.delete({
      where: { id: itemId },
    });

    return { success: true, message: 'Item deleted.' };
  }
}
