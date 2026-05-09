import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

class CreateGoalDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  targetDate?: string;

  @IsOptional()
  @IsNumber()
  targetAmount?: number;
}

class UpdateGoalDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;

  @IsOptional()
  @IsString()
  targetDate?: string;

  @IsOptional()
  @IsNumber()
  progress?: number;

  @IsOptional()
  @IsNumber()
  targetAmount?: number;
}

@Controller('goals')
@UseGuards(ApiKeyGuard, JwtAuthGuard)
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Post()
  async createGoal(
    @CurrentUser() user: any,
    @Body() body: CreateGoalDto,
  ) {
    return this.goalsService.createGoal(
      user.userId,
      body.title,
      body.description,
      body.targetDate,
      body.targetAmount,
    );
  }

  @Get()
  async getGoals(@CurrentUser() user: any) {
    return this.goalsService.getGoals(user.userId);
  }

  @Patch(':id')
  async updateGoal(
    @CurrentUser() user: any,
    @Param('id') goalId: string,
    @Body() body: UpdateGoalDto,
  ) {
    return this.goalsService.updateGoal(
      user.userId,
      goalId,
      body.title,
      body.description,
      body.isCompleted,
      body.targetDate,
      body.progress,
      body.targetAmount,
    );
  }

  @Delete(':id')
  async deleteGoal(
    @CurrentUser() user: any,
    @Param('id') goalId: string,
  ) {
    return this.goalsService.deleteGoal(user.userId, goalId);
  }
}
