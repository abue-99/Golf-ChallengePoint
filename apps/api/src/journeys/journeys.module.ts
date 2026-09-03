import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { JourneysController } from './journeys.controller';
import { JourneysService } from './journeys.service';
import { CoachJourneysController } from './coach-journeys.controller';

@Module({
  imports: [PrismaModule],
  controllers: [JourneysController, CoachJourneysController],
  providers: [JourneysService],
  exports: [JourneysService],
})
export class JourneysModule {}
