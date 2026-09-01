import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { AssignmentsService } from './assignments.service';

@Controller('assignments')
@UseGuards(JwtAuthGuard)
export class AssignmentsController {
  constructor(private readonly service: AssignmentsService) {}

  @Get('my')
  listMyAssignments(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('queueOnly') queueOnly?: string,
  ) {
    return this.service.listMyAssignments(user.id, user.role as string, {
      status,
      queueOnly,
    });
  }

  @Post()
  createAssignment(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      lessonId: string;
      targetType?: string;
      playerId?: string;
      teamId?: string;
      groupName?: string;
      blockId?: string;
      teamEventId?: string;
      dueDate?: string;
      priority?: string;
      sortOrder?: number;
      isInTrainingQueue?: boolean;
      schedule?: {
        practiceSlotId: string;
        title?: string;
        description?: string;
        scheduledDate: string;
        durationMinutes?: number;
      };
    },
  ) {
    return this.service.createAssignment(user.id, user.role as string, body);
  }

  @Patch(':id')
  updateAssignment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body()
    body: {
      status?: string;
      dueDate?: string | null;
      priority?: string;
      sortOrder?: number;
      playerNotes?: string;
      selfAssessment?: number | null;
      isInTrainingQueue?: boolean;
    },
  ) {
    return this.service.updateAssignment(user.id, user.role as string, id, body);
  }

  @Post(':id/queue')
  moveToQueue(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.moveToQueue(user.id, user.role as string, id);
  }
}
