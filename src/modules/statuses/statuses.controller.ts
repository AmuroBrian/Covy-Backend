import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { StatusesService } from './statuses.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsString, IsOptional } from 'class-validator';

class CreateStatusDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsString()
  emoji?: string;

  @IsOptional()
  @IsString()
  expiresAt?: string;
}

@Controller('statuses')
@UseGuards(ApiKeyGuard, JwtAuthGuard)
export class StatusesController {
  constructor(private readonly statusesService: StatusesService) {}

  @Post()
  async createStatus(
    @CurrentUser() user: any,
    @Body() body: CreateStatusDto,
  ) {
    return this.statusesService.createStatus(
      user.userId,
      body.text,
      body.emoji,
      body.expiresAt,
    );
  }

  @Get()
  async getStatuses(@CurrentUser() user: any) {
    return this.statusesService.getStatuses(user.userId);
  }
}
