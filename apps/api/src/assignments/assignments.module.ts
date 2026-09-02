import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';
import { CoachWorkspaceController } from './coach-workspace.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AssignmentsController, CoachWorkspaceController],
  providers: [AssignmentsService],
})
export class AssignmentsModule {}
