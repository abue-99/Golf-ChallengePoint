import { Controller, Get, Post, Param, UseGuards, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { GamificationService } from './gamification.service';

@Controller('gamification')
@UseGuards(JwtAuthGuard)
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get(':userId')
  getProfile(@Param('userId') userId: string, @CurrentUser() caller: AuthenticatedUser) {
    if (caller.id !== userId) {
      throw new ForbiddenException();
    }
    return this.gamificationService.getProfile(userId);
  }

  @Post(':userId/activity')
  recordActivity(@Param('userId') userId: string, @CurrentUser() caller: AuthenticatedUser) {
    if (caller.id !== userId) {
      throw new ForbiddenException();
    }
    return this.gamificationService.recordActivity(userId);
  }
}
