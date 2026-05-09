import { Controller, Post, UseGuards } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
@UseGuards(ApiKeyGuard, JwtAuthGuard) // Protect with both API Key and Supabase JWT
export class AuthController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Syncs the Supabase user with the local Prisma database.
   * This should be called by the mobile app immediately after a successful Supabase login/signup.
   */
  @Post('sync')
  async syncUser(@CurrentUser() user: any) {
    // The JWT strategy validates the token and attaches the payload to req.user
    // payload.sub is mapped to user.userId in the strategy
    const syncedUser = await this.usersService.syncUser(user.userId, user.email);
    
    return {
      message: 'User synced successfully',
      user: syncedUser,
    };
  }
}
