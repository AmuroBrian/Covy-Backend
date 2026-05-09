import { Controller, Get, Post, Patch, Body, Query, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsOptional, IsString, IsEnum, IsNumber, Min } from 'class-validator';

// DTOs defined in-file for brevity, but should be moved to separate files ideally
class SendMessageDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @IsOptional()
  @IsEnum(['TEXT', 'IMAGE', 'AUDIO'])
  type?: 'TEXT' | 'IMAGE' | 'AUDIO';
}

class GetMessagesDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  limit?: string; // Query params come in as strings
}

@Controller('chat')
@UseGuards(ApiKeyGuard, JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  async getMessages(
    @CurrentUser() user: any,
    @Query() query: GetMessagesDto,
  ) {
    const limit = query.limit ? parseInt(query.limit, 10) : 50;
    return this.chatService.getMessages(user.userId, query.cursor, limit);
  }

  @Post()
  async sendMessage(
    @CurrentUser() user: any,
    @Body() body: SendMessageDto,
  ) {
    return this.chatService.sendMessage(
      user.userId,
      body.content,
      body.mediaUrl,
      body.type || 'TEXT',
    );
  }

  @Patch('read')
  async markAsRead(@CurrentUser() user: any) {
    return this.chatService.markAsRead(user.userId);
  }
}
