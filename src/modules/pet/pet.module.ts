import { Module } from '@nestjs/common';
import { PetService } from './pet.service';

import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [PetService],
  exports: [PetService],
})
export class PetModule {}
