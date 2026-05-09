import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

class CreateBudgetDto {
  @IsString()
  month: string; // YYYY-MM-DD

  @IsNumber()
  @Min(0)
  totalBudget: number;
}

class AddExpenseDto {
  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  category: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  date?: string;
}

@Controller('finance')
@UseGuards(ApiKeyGuard, JwtAuthGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Post('budgets')
  async createBudget(
    @CurrentUser() user: any,
    @Body() body: CreateBudgetDto,
  ) {
    return this.financeService.createBudget(
      user.userId,
      body.month,
      body.totalBudget,
    );
  }

  @Get('budgets')
  async getBudgets(@CurrentUser() user: any) {
    return this.financeService.getBudgets(user.userId);
  }

  @Get('budgets/summary')
  async getBudgetSummary(
    @CurrentUser() user: any,
    @Query('month') month: string,
  ) {
    return this.financeService.getBudgetSummary(user.userId, month);
  }

  @Post('budgets/:budgetId/expenses')
  async addExpense(
    @CurrentUser() user: any,
    @Param('budgetId') budgetId: string,
    @Body() body: AddExpenseDto,
  ) {
    return this.financeService.addExpense(
      user.userId,
      budgetId,
      body.amount,
      body.category,
      body.description,
      body.date,
    );
  }

  @Delete('expenses/:expenseId')
  async deleteExpense(
    @CurrentUser() user: any,
    @Param('expenseId') expenseId: string,
  ) {
    return this.financeService.deleteExpense(user.userId, expenseId);
  }
}
