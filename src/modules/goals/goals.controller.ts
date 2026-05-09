import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

class CreateGoalDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  targetDate?: string;
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
