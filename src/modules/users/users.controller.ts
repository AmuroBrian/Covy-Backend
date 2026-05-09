import { Controller, Get, Patch, Body, UseGuards, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('users')
@UseGuards(ApiKeyGuard, JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('profile')
  async getProfile(@CurrentUser() user: any) {
    const profile = await this.prisma.user.findFirst({
      where: { providerId: user.userId },
      include: {
        couple: {
          include: {
            users: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
                gender: true,
                providerId: true,
              },
            },
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found. Make sure to call /auth/sync first.');
    }
    return profile;
  }

  @Patch('profile')
  async updateProfile(@CurrentUser() user: any, @Body() updateProfileDto: UpdateProfileDto) {
    const updatedProfile = await this.usersService.updateProfile(user.userId, updateProfileDto);
    return {
      message: 'Profile updated successfully',
      profile: updatedProfile,
    };
  }
}
