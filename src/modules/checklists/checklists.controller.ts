import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ChecklistsService } from './checklists.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

class CreateChecklistDto {
  @IsString()
  title: string;
}

class AddItemDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  dueDate?: string;
}

class UpdateItemDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  dueDate?: string;
}

@Controller('checklists')
@UseGuards(ApiKeyGuard, JwtAuthGuard)
export class ChecklistsController {
  constructor(private readonly checklistsService: ChecklistsService) {}

  @Post()
  async createChecklist(
    @CurrentUser() user: any,
    @Body() body: CreateChecklistDto,
  ) {
    return this.checklistsService.createChecklist(user.userId, body.title);
  }

  @Get()
  async getChecklists(@CurrentUser() user: any) {
    return this.checklistsService.getChecklists(user.userId);
  }

  @Delete(':id')
  async deleteChecklist(
    @CurrentUser() user: any,
    @Param('id') checklistId: string,
  ) {
    return this.checklistsService.deleteChecklist(user.userId, checklistId);
  }

  @Post(':id/items')
  async addChecklistItem(
    @CurrentUser() user: any,
    @Param('id') checklistId: string,
    @Body() body: AddItemDto,
  ) {
    return this.checklistsService.addChecklistItem(
      user.userId,
      checklistId,
      body.title,
      body.assignedToId,
      body.dueDate,
    );
  }

  @Patch('items/:itemId')
  async updateChecklistItem(
    @CurrentUser() user: any,
    @Param('itemId') itemId: string,
    @Body() body: UpdateItemDto,
  ) {
    return this.checklistsService.updateChecklistItem(
      user.userId,
      itemId,
      body.isCompleted,
      body.title,
      body.assignedToId,
      body.dueDate,
    );
  }

  @Delete('items/:itemId')
  async deleteChecklistItem(
    @CurrentUser() user: any,
    @Param('itemId') itemId: string,
  ) {
    return this.checklistsService.deleteChecklistItem(user.userId, itemId);
  }
}
