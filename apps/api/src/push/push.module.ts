import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PushController } from './push.controller';
import { PushService } from './push.service';
import { PUSH_HOOKS } from '../game/game-hooks';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PushController],
  providers: [PushService, { provide: PUSH_HOOKS, useExisting: PushService }],
  exports: [PushService, PUSH_HOOKS],
})
export class PushModule {}
