import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { ChecklistsController } from './checklists.controller';
import { ChecklistsService } from './checklists.service';

@Module({
  imports: [RealtimeModule],
  controllers: [ChecklistsController],
  providers: [ChecklistsService]
})
export class ChecklistsModule {}
