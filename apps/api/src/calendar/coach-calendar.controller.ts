import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { CoachCalendarService } from './coach-calendar.service';
import { AttendanceReminderService } from './attendance-reminder.service';

/** The coach's own calendar: teams, sessions and the players' answers. */
@Controller('calendar/coach')
@UseGuards(JwtAuthGuard)
export class CoachCalendarController {
  constructor(
    private readonly coachCalendar: CoachCalendarService,
    private readonly reminders: AttendanceReminderService,
  ) {}

  /** GET /calendar/coach?from=&to=&teamId= */
  @Get()
  getCalendar(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('teamId') teamId?: string,
  ) {
    return this.coachCalendar.getCalendar(user.id, user.role as string, {
      from,
      to,
      teamId: teamId || undefined,
    });
  }

  /** POST /calendar/coach/remind – e-mail players without an answer. */
  @Post('remind')
  @HttpCode(HttpStatus.OK)
  remind(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { occurrenceKey?: unknown },
  ) {
    return this.reminders.remind(
      user.id,
      user.role as string,
      body?.occurrenceKey,
    );
  }

  /** PUT /calendar/coach/teams/:teamId/auto-remind – { hours: number | null } */
  @Put('teams/:teamId/auto-remind')
  setAutoRemind(
    @CurrentUser() user: AuthenticatedUser,
    @Param('teamId') teamId: string,
    @Body() body: { hours?: unknown },
  ) {
    return this.reminders.setAutoRemind(
      user.id,
      user.role as string,
      teamId,
      body?.hours ?? null,
    );
  }
}
