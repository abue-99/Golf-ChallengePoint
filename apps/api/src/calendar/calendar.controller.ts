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

  @Get('slots')
  listSlots(
    @CurrentUser() user: AuthenticatedUser,
    @Query('playerId') playerId?: string,
  ) {
    return this.calendarService.listSlots(user.id, user.role as string, playerId);
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
    throw new ForbiddenException('Only players can create personal practice slots');
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
    return this.calendarService.createTeamSlot(user.id, user.role as string, teamId, body);
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

  @Get('availability')
  listAvailabilityBlocks(
    @CurrentUser() user: AuthenticatedUser,
    @Query('playerId') playerId?: string,
  ) {
    return this.calendarService.listAvailabilityBlocks(user.id, user.role as string, playerId);
  }

  @Post('availability')
  @HttpCode(HttpStatus.CREATED)
  createAvailabilityBlock(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      playerId?: string;
      title: string;
      type?: string;
      startTime: string;
      endTime: string;
      recurrence?: string;
      recurrenceEndDate?: string;
      notes?: string;
    },
  ) {
    return this.calendarService.createAvailabilityBlock(user.id, user.role as string, body);
  }

  @Patch('availability/:id')
  updateAvailabilityBlock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      type?: string;
      startTime?: string;
      endTime?: string;
      recurrence?: string;
      recurrenceEndDate?: string | null;
      notes?: string | null;
    },
  ) {
    return this.calendarService.updateAvailabilityBlock(user.id, user.role as string, id, body);
  }

  @Delete('availability/:id')
  @HttpCode(HttpStatus.OK)
  deleteAvailabilityBlock(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.calendarService.deleteAvailabilityBlock(user.id, user.role as string, id);
  }

  @Get('team-events')
  listTeamEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Query('teamId') teamId?: string,
  ) {
    return this.calendarService.listTeamEvents(user.id, user.role as string, teamId);
  }

  @Post('team-events')
  @HttpCode(HttpStatus.CREATED)
  createTeamEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      teamId: string;
      title: string;
      description?: string;
      location?: string;
      startTime: string;
      endTime: string;
    },
  ) {
    return this.calendarService.createTeamEvent(user.id, user.role as string, body);
  }

  @Patch('team-events/:id')
  updateTeamEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      description?: string | null;
      location?: string | null;
      startTime?: string;
      endTime?: string;
    },
  ) {
    return this.calendarService.updateTeamEvent(user.id, user.role as string, id, body);
  }

  @Delete('team-events/:id')
  @HttpCode(HttpStatus.OK)
  deleteTeamEvent(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.calendarService.deleteTeamEvent(user.id, user.role as string, id);
  }

  @Get('tournaments')
  listTournaments(
    @CurrentUser() user: AuthenticatedUser,
    @Query('playerId') playerId?: string,
  ) {
    return this.calendarService.listTournaments(user.id, user.role as string, playerId);
  }

  @Post('tournaments')
  @HttpCode(HttpStatus.CREATED)
  createTournament(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      playerId?: string;
      title: string;
      description?: string;
      location?: string;
      startTime: string;
      endTime: string;
      priority?: string;
    },
  ) {
    return this.calendarService.createTournament(user.id, user.role as string, body);
  }

  @Patch('tournaments/:id')
  updateTournament(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      description?: string | null;
      location?: string | null;
      startTime?: string;
      endTime?: string;
      priority?: string;
    },
  ) {
    return this.calendarService.updateTournament(user.id, user.role as string, id, body);
  }

  @Delete('tournaments/:id')
  @HttpCode(HttpStatus.OK)
  deleteTournament(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.calendarService.deleteTournament(user.id, user.role as string, id);
  }

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
      lessonId?: string;
    },
  ) {
    const role = user.role as string;
    if (role !== 'COACH' && role !== 'ADMIN') {
      throw new ForbiddenException('Only coaches can assign tasks');
    }
    return this.calendarService.assignTask(user.id, role, slotId, body);
  }

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
      status?: string;
      lessonId?: string | null;
    },
  ) {
    return this.calendarService.updateTask(user.id, user.role as string, id, body);
  }

  @Delete('tasks/:id')
  @HttpCode(HttpStatus.OK)
  deleteTask(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.calendarService.deleteTask(user.id, user.role as string, id);
  }

  @Get('player/:playerId')
  getPlayerCalendar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('playerId') playerId: string,
  ) {
    return this.calendarService.getPlayerCalendar(user.id, user.role as string, playerId);
  }
}
