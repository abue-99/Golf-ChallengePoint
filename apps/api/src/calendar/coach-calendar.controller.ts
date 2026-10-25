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
import { OccurrenceChangeService } from './occurrence-change.service';
import { TeamAvailabilityService } from './team-availability.service';

/** The coach's own calendar: teams, sessions and the players' answers. */
@Controller('calendar/coach')
@UseGuards(JwtAuthGuard)
export class CoachCalendarController {
  constructor(
    private readonly coachCalendar: CoachCalendarService,
    private readonly reminders: AttendanceReminderService,
    private readonly occurrences: OccurrenceChangeService,
    private readonly availability: TeamAvailabilityService,
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

  /**
   * PUT /calendar/coach/occurrences – move, cancel or restore one occurrence
   * of a team training: { occurrenceKey, action: "move" | "cancel" |
   * "restore", startTime?, endTime?, reason?, notify?, force? }
   */
  @Put('occurrences')
  changeOccurrence(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      occurrenceKey?: unknown;
      action?: unknown;
      startTime?: unknown;
      endTime?: unknown;
      reason?: unknown;
      notify?: unknown;
      force?: unknown;
    },
  ) {
    return this.occurrences.change(user.id, user.role as string, body ?? {});
  }

  /**
   * GET /calendar/coach/teams/:teamId/availability?from=&to= – when the
   * team's players are busy (time finder).
   */
  @Get('teams/:teamId/availability')
  getAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Param('teamId') teamId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.availability.getAvailability(
      user.id,
      user.role as string,
      teamId,
      { from, to },
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
