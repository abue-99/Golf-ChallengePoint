import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { CalendarFeedService } from './calendar-feed.service';
import { AttendanceService } from './attendance.service';

/** Calendar subscription (ICS) and attendance answers. */
@Controller('calendar')
export class CalendarFeedController {
  constructor(
    private readonly feed: CalendarFeedService,
    private readonly attendance: AttendanceService,
  ) {}

  /** GET /calendar/feed – the caller's subscription token (created on first use). */
  @Get('feed')
  @UseGuards(JwtAuthGuard)
  getFeed(@CurrentUser() user: AuthenticatedUser) {
    return this.feed.getOrCreate(user.id);
  }

  /** POST /calendar/feed/rotate – new secret URL, the old one stops working. */
  @Post('feed/rotate')
  @UseGuards(JwtAuthGuard)
  rotateFeed(@CurrentUser() user: AuthenticatedUser) {
    return this.feed.rotate(user.id);
  }

  /**
   * GET /calendar/feed/ics/:file – public, the secret token is the auth.
   * `:file` is "<token>.ics"; calendar apps like the extension.
   */
  @Get('feed/ics/:file')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header('Cache-Control', 'private, max-age=300')
  renderFeed(@Param('file') file: string) {
    return this.feed.renderFeed(file.replace(/\.ics$/i, ''));
  }

  /** PUT /calendar/attendance – a player answers for one team occurrence. */
  @Put('attendance')
  @UseGuards(JwtAuthGuard)
  respond(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      practiceSlotId?: unknown;
      teamEventId?: unknown;
      occurrenceStart?: unknown;
      status?: unknown;
      note?: unknown;
    },
  ) {
    return this.attendance.respond(user.id, user.role as string, body ?? {});
  }
}
