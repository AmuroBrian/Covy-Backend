import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [HttpModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService], // Export so ChatModule or RealtimeModule can use it
})
export class NotificationsModule {}
