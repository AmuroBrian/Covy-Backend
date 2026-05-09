import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async createBudget(currentUserId: string, month: string, totalBudget: number) {
    const user = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
    });

    if (!user || !user.coupleId) {
      throw new BadRequestException('User is not in a couple.');
    }

    // Ensure the month is saved consistently as the first day of the month
    const targetMonth = new Date(month);
    targetMonth.setDate(1);
    targetMonth.setHours(0, 0, 0, 0);

    // Check if budget already exists for this month
    const existingBudget = await this.prisma.budget.findFirst({
      where: {
        coupleId: user.coupleId,
        month: targetMonth,
      },
    });

    if (existingBudget) {
      return this.prisma.budget.update({
        where: { id: existingBudget.id },
        data: { totalBudget },
      });
    }

    return this.prisma.budget.create({
      data: {
        coupleId: user.coupleId,
        month: targetMonth,
        totalBudget,
      },
    });
  }

  async getBudgets(currentUserId: string) {
    const user = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
    });

    if (!user || !user.coupleId) {
      throw new BadRequestException('User is not in a couple.');
    }

    return this.prisma.budget.findMany({
      where: { coupleId: user.coupleId },
      orderBy: { month: 'desc' },
      include: { expenses: true },
    });
  }

  async addExpense(
    currentUserId: string,
    budgetId: string,
    amount: number,
    category: string,
    description?: string,
    date?: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
    });

    if (!user || !user.coupleId) {
      throw new BadRequestException('User is not in a couple.');
    }

    const budget = await this.prisma.budget.findUnique({
      where: { id: budgetId },
    });

    if (!budget || budget.coupleId !== user.coupleId) {
      throw new NotFoundException('Budget not found.');
    }

    return this.prisma.expense.create({
      data: {
        budgetId,
        userId: user.id,
        amount,
        category,
        description,
        date: date ? new Date(date) : new Date(),
      },
      include: {
        user: { select: { id: true, displayName: true } },
      },
    });
  }

  async getBudgetSummary(currentUserId: string, month: string) {
    const user = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
    });

    if (!user || !user.coupleId) {
      throw new BadRequestException('User is not in a couple.');
    }

    const targetMonth = new Date(month);
    targetMonth.setDate(1);
    targetMonth.setHours(0, 0, 0, 0);

    const budget = await this.prisma.budget.findFirst({
      where: {
        coupleId: user.coupleId,
        month: targetMonth,
      },
      include: {
        expenses: {
          include: { user: { select: { id: true, displayName: true } } },
          orderBy: { date: 'desc' },
        },
      },
    });

    if (!budget) {
      return { totalBudget: 0, totalExpenses: 0, remaining: 0, expenses: [] };
    }

    const totalExpenses = budget.expenses.reduce((sum, expense) => sum + expense.amount, 0);

    return {
      id: budget.id,
      month: budget.month,
      totalBudget: budget.totalBudget,
      totalExpenses,
      remaining: budget.totalBudget - totalExpenses,
      expenses: budget.expenses,
    };
  }

  async deleteExpense(currentUserId: string, expenseId: string) {
    const user = await this.prisma.user.findFirst({
      where: { providerId: currentUserId },
    });

    if (!user || !user.coupleId) {
      throw new BadRequestException('User is not in a couple.');
    }

    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
      include: { budget: true },
    });

    if (!expense || expense.budget.coupleId !== user.coupleId) {
      throw new NotFoundException('Expense not found.');
    }

    await this.prisma.expense.delete({
      where: { id: expenseId },
    });

    return { success: true, message: 'Expense deleted.' };
  }
}
