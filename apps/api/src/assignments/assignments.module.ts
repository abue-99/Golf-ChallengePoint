import { GameModule } from '../game/game.module';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';
import { CoachAssignmentsController } from './coach-assignments.controller';

@Module({
  imports: [PrismaModule, GameModule],
  controllers: [AssignmentsController, CoachAssignmentsController],
  providers: [AssignmentsService],
})
export class AssignmentsModule {}
