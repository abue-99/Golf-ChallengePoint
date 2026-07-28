import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { CalendarService } from './calendar.service';

@Controller('calendar')
@UseGuards(JwtAuthGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  // ─── Practice Slots ───────────────────────────────────────────────────────

  @Get('slots')
  listSlots(
    @CurrentUser() user: AuthenticatedUser,
    @Query('playerId') playerId?: string,
  ) {
    return this.calendarService.listSlots(user.id, playerId);
  }

  @Post('slots')
  @HttpCode(HttpStatus.CREATED)
  createSlot(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      title: string;
      startTime: string;
      endTime: string;
      recurrence?: string;
      recurrenceEndDate?: string;
      playerId?: string;
    },
  ) {
    const role = user.role as string;
    if (role === 'PLAYER') {
      return this.calendarService.createSlot(user.id, body);
    }
    throw new ForbiddenException(
      'Only players can create personal practice slots',
    );
  }

  @Get('team-slots/:teamId')
  listTeamSlots(
    @CurrentUser() user: AuthenticatedUser,
    @Param('teamId') teamId: string,
  ) {
    return this.calendarService.listTeamSlots(user.id, user.role as string, teamId);
  }

  @Post('team-slots/:teamId')
  @HttpCode(HttpStatus.CREATED)
  createTeamSlot(
    @CurrentUser() user: AuthenticatedUser,
    @Param('teamId') teamId: string,
    @Body()
    body: {
      title: string;
      startTime: string;
      endTime: string;
      recurrence?: string;
      recurrenceEndDate?: string;
    },
  ) {
    return this.calendarService.createTeamSlot(
      user.id,
      user.role as string,
      teamId,
      body,
    );
  }

  @Patch('slots/:id')
  @HttpCode(HttpStatus.OK)
  updateSlot(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      startTime?: string;
      endTime?: string;
      recurrence?: string;
      recurrenceEndDate?: string | null;
    },
  ) {
    return this.calendarService.updateSlot(user.id, user.role as string, id, body);
  }

  @Delete('slots/:id')
  @HttpCode(HttpStatus.OK)
  deleteSlot(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.calendarService.deleteSlot(user.id, user.role as string, id);
  }

  // ─── Slot Tasks ───────────────────────────────────────────────────────────

  @Get('slots/:slotId/tasks')
  listSlotTasks(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slotId') slotId: string,
  ) {
    return this.calendarService.listSlotTasks(user.id, user.role as string, slotId);
  }

  @Post('slots/:slotId/tasks')
  @HttpCode(HttpStatus.CREATED)
  assignTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slotId') slotId: string,
    @Body()
    body: {
      title: string;
      description: string;
      durationMinutes: number;
      scheduledDate: string;
      recurrenceCount?: number;
      recurrenceWeeks?: number;
    },
  ) {
    const role = user.role as string;
    if (role !== 'COACH' && role !== 'ADMIN') {
      throw new ForbiddenException('Only coaches can assign tasks');
    }
    return this.calendarService.assignTask(user.id, role, slotId, body);
  }

  // ─── Calendar Tasks ───────────────────────────────────────────────────────

  @Patch('tasks/:id')
  @HttpCode(HttpStatus.OK)
  updateTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      description?: string;
      durationMinutes?: number;
      scheduledDate?: string;
    },
  ) {
    return this.calendarService.updateTask(user.id, id, body);
  }

  @Delete('tasks/:id')
  @HttpCode(HttpStatus.OK)
  deleteTask(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.calendarService.deleteTask(user.id, id);
  }

  // ─── Full Calendar View ───────────────────────────────────────────────────

  @Get('player/:playerId')
  getPlayerCalendar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('playerId') playerId: string,
  ) {
    return this.calendarService.getPlayerCalendar(user.id, playerId);
  }
}
