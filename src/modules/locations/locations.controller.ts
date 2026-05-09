import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('locations')
@UseGuards(ApiKeyGuard, JwtAuthGuard)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('latest')
  async getLatestLocation(@CurrentUser() user: any) {
    return this.locationsService.getLatestPartnerLocation(user.userId);
  }

  @Get('history')
  async getLocationHistory(
    @CurrentUser() user: any,
    @Query('limit') limitStr?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitStr ? parseInt(limitStr, 10) : 100;
    return this.locationsService.getPartnerLocationHistory(user.userId, limit, cursor);
  }
}
