import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { CalendarFeedController } from './calendar-feed.controller';
import { CalendarFeedService } from './calendar-feed.service';
import { AttendanceService } from './attendance.service';
import { CoachCalendarController } from './coach-calendar.controller';
import { CoachCalendarService } from './coach-calendar.service';
import { AttendanceReminderService } from './attendance-reminder.service';
import { ReminderMailer } from './reminder-mail';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [
    CalendarFeedController,
    CoachCalendarController,
    CalendarController,
  ],
  providers: [
    CalendarService,
    CalendarFeedService,
    AttendanceService,
    CoachCalendarService,
    AttendanceReminderService,
    ReminderMailer,
  ],
})
export class CalendarModule {}
