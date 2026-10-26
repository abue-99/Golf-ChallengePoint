import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ClubsModule } from './clubs/clubs.module';
import { TeamsModule } from './teams/teams.module';
import { UsersModule } from './users/users.module';
import { CalendarModule } from './calendar/calendar.module';
import { LessonsModule } from './lessons/lessons.module';
import { DevelopmentPlansModule } from './development-plans/development-plans.module';
import { GamificationModule } from './gamification/gamification.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { JourneysModule } from './journeys/journeys.module';
import { RosterModule } from './roster/roster.module';

import { MessagesModule } from './messages/messages.module';
import { GameModule } from './game/game.module';
import { PushModule } from './push/push.module';
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ClubsModule,
    TeamsModule,
    UsersModule,
    CalendarModule,
    LessonsModule,
    DevelopmentPlansModule,
    GamificationModule,
    AssignmentsModule,
    JourneysModule,
    RosterModule,
    MessagesModule,
    GameModule,
    PushModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
