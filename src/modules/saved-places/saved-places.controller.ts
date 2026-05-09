import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { SavedPlacesService } from './saved-places.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsString, IsNumber, Min } from 'class-validator';

class CreateSavedPlaceDto {
  @IsString()
  label: string;

  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;

  @IsNumber()
  @Min(10)
  radius: number; // in meters
}

@Controller('saved-places')
@UseGuards(ApiKeyGuard, JwtAuthGuard)
export class SavedPlacesController {
  constructor(private readonly savedPlacesService: SavedPlacesService) {}

  @Post()
  async createSavedPlace(
    @CurrentUser() user: any,
    @Body() body: CreateSavedPlaceDto,
  ) {
    return this.savedPlacesService.createSavedPlace(
      user.userId,
      body.label,
      body.lat,
      body.lng,
      body.radius,
    );
  }

  @Get()
  async getSavedPlaces(@CurrentUser() user: any) {
    return this.savedPlacesService.getSavedPlaces(user.userId);
  }

  @Delete(':id')
  async deleteSavedPlace(@CurrentUser() user: any, @Param('id') id: string) {
    return this.savedPlacesService.deleteSavedPlace(user.userId, id);
  }
}
