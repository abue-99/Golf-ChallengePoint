import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { CoachCalendarService } from './coach-calendar.service';

/** The coach's own calendar: teams, sessions and the players' answers. */
@Controller('calendar/coach')
@UseGuards(JwtAuthGuard)
export class CoachCalendarController {
  constructor(private readonly coachCalendar: CoachCalendarService) {}

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
}
