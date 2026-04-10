import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ClubsModule } from './clubs/clubs.module';
import { TeamsModule } from './teams/teams.module';

@Module({
  imports: [PrismaModule, AuthModule, ClubsModule, TeamsModule],
  controllers: [AppController],
})
export class AppModule {}
