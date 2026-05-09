import { Controller, Post, Body, UseGuards, Delete } from '@nestjs/common';
import { CouplesService } from './couples.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('couples')
@UseGuards(ApiKeyGuard, JwtAuthGuard)
export class CouplesController {
  constructor(private readonly couplesService: CouplesService) {}

  @Post('connect')
  async connectPartner(
    @CurrentUser() user: any,
    @Body('inviteCode') inviteCode: string,
  ) {
    return this.couplesService.connectPartner(user.userId, inviteCode);
  }

  @Delete('disconnect')
  async disconnectPartner(@CurrentUser() user: any) {
    return this.couplesService.disconnectPartner(user.userId);
  }
}
