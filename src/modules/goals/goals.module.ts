import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';

@Module({
  imports: [RealtimeModule],
  controllers: [GoalsController],
  providers: [GoalsService]
})
export class GoalsModule {}
