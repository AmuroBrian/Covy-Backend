import { Module } from '@nestjs/common';
import { RealtimeController } from './realtime.controller';
import { RealtimeService } from './realtime.service';
import { RealtimeGateway } from './realtime.gateway';
import { NotificationsModule } from '../notifications/notifications.module';
import { PetModule } from '../pet/pet.module';

@Module({
  imports: [NotificationsModule, PetModule],
  controllers: [RealtimeController],
  providers: [RealtimeService, RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
