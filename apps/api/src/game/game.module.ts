import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PushModule } from '../push/push.module';
import { GameService } from './game.service';
import { MissionService } from './mission.service';
import { TeamGameService } from './team-game.service';
import { CoachGameService } from './coach-game.service';
import { GameController } from './game.controller';
import { CoachGameController } from './coach-game.controller';
import { GAME_HOOKS } from './game-hooks';

@Module({
  imports: [PrismaModule, AuthModule, PushModule],
  controllers: [GameController, CoachGameController],
  providers: [
    GameService,
    MissionService,
    TeamGameService,
    CoachGameService,
    { provide: GAME_HOOKS, useExisting: GameService },
  ],
  exports: [GameService, GAME_HOOKS],
})
export class GameModule {}
