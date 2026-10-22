import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RosterController } from './roster.controller';
import { RosterService } from './roster.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RosterController],
  providers: [RosterService],
})
export class RosterModule {}
