import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RosterController } from './roster.controller';
import { RosterService } from './roster.service';
import { CoachWorkService } from './coach-work.service';
import { PlayerLoadService } from './player-load.service';
import { TeamsModule } from '../teams/teams.module';

@Module({
  imports: [PrismaModule, AuthModule, TeamsModule],
  controllers: [RosterController],
  providers: [RosterService, CoachWorkService, PlayerLoadService],
})
export class RosterModule {}
