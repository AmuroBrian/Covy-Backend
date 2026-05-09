import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsString, IsOptional } from 'class-validator';

class RegisterDeviceDto {
  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  model?: string;

}

@Controller('devices')
@UseGuards(ApiKeyGuard, JwtAuthGuard)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post('register')
  async registerDevice(
    @CurrentUser() user: any,
    @Body() body: RegisterDeviceDto,
  ) {
    return this.devicesService.registerDevice(
      user.userId,
      body.platform,
      body.model,
    );
  }

  @Get('partner')
  async getPartnerDevice(@CurrentUser() user: any) {
    return this.devicesService.getPartnerDevice(user.userId);
  }
}
