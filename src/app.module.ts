import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CouplesModule } from './modules/couples/couples.module';
import { LocationsModule } from './modules/locations/locations.module';
import { SavedPlacesModule } from './modules/saved-places/saved-places.module';
import { DevicesModule } from './modules/devices/devices.module';
import { StatusesModule } from './modules/statuses/statuses.module';
import { ChatModule } from './modules/chat/chat.module';
import { ChecklistsModule } from './modules/checklists/checklists.module';
import { GoalsModule } from './modules/goals/goals.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { HealthModule } from './modules/health/health.module';

import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule, AuthModule, UsersModule, CouplesModule, LocationsModule, SavedPlacesModule, DevicesModule, StatusesModule, ChatModule, ChecklistsModule, GoalsModule, NotificationsModule, RealtimeModule, HealthModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
