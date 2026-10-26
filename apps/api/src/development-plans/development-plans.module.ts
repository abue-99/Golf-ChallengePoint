import { GameModule } from '../game/game.module';
import { Module } from '@nestjs/common';
import { DevelopmentPlansController } from './development-plans.controller';
import { DevelopmentPlansService } from './development-plans.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, GameModule],
  controllers: [DevelopmentPlansController],
  providers: [DevelopmentPlansService],
})
export class DevelopmentPlansModule {}
