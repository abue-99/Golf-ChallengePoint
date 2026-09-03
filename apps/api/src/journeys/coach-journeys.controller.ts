import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { JourneysService } from './journeys.service';

@Controller('coach/journeys')
@UseGuards(JwtAuthGuard)
export class CoachJourneysController {
  constructor(private readonly journeysService: JourneysService) {}

  @Post(':journeyId/assign/player/:playerId')
  assignToPlayer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('journeyId') journeyId: string,
    @Param('playerId') playerId: string,
  ) {
    return this.journeysService.assignTemplateToPlayer(
      user.id,
      user.role as string,
      journeyId,
      playerId,
    );
  }

  @Post(':journeyId/assign/team/:teamId')
  assignToTeam(
    @CurrentUser() user: AuthenticatedUser,
    @Param('journeyId') journeyId: string,
    @Param('teamId') teamId: string,
  ) {
    return this.journeysService.assignTemplateToTeam(
      user.id,
      user.role as string,
      journeyId,
      teamId,
    );
  }
}
