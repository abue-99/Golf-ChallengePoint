import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RosterController } from './roster.controller';
import { RosterService } from './roster.service';
import { CoachWorkService } from './coach-work.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RosterController],
  providers: [RosterService, CoachWorkService],
})
export class RosterModule {}
