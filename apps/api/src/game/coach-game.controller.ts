import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { CoachGameService } from './coach-game.service';

/**
 * Coach side of the game. Lives under /coach/roster so the existing BFF
 * route and Caddy block cover it.
 */
@Controller('coach/roster')
@UseGuards(JwtAuthGuard)
export class CoachGameController {
  constructor(private readonly coach: CoachGameService) {}

  /** GET /coach/roster/feed?before=&playerId=&limit= – "Recent activity". */
  @Get('feed')
  feed(
    @CurrentUser() user: AuthenticatedUser,
    @Query('before') before?: string,
    @Query('playerId') playerId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.coach.feed(user.id, user.role as string, {
      before,
      playerId,
      limit,
    });
  }

  @Post('feed/seen')
  feedSeen(@CurrentUser() user: AuthenticatedUser) {
    return this.coach.feedSeen(user.id);
  }

  /** POST /coach/roster/assignments/:id/review – { rating 1–5, comment?, pick? } */
  @Post('assignments/:id/review')
  review(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { rating?: unknown; comment?: unknown; pick?: unknown },
  ) {
    return this.coach.review(user.id, user.role as string, id, body ?? {});
  }

  @Get('players/:playerId/card')
  card(
    @CurrentUser() user: AuthenticatedUser,
    @Param('playerId') playerId: string,
  ) {
    return this.coach.playerCard(user.id, user.role as string, playerId);
  }

  /** GET /coach/roster/players/:playerId/work – open missions from all coaches. */
  @Get('players/:playerId/work')
  work(
    @CurrentUser() user: AuthenticatedUser,
    @Param('playerId') playerId: string,
  ) {
    return this.coach.playerWork(user.id, user.role as string, playerId);
  }

  @Get('challenges')
  challenges(
    @CurrentUser() user: AuthenticatedUser,
    @Query('teamId') teamId?: string,
  ) {
    return this.coach.listChallenges(user.id, user.role as string, teamId);
  }

  @Post('challenges')
  createChallenge(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.coach.createChallenge(user.id, user.role as string, body ?? {});
  }

  @Patch('challenges/:id')
  updateChallenge(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.coach.updateChallenge(
      user.id,
      user.role as string,
      id,
      body ?? {},
    );
  }

  @Delete('challenges/:id')
  deleteChallenge(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.coach.deleteChallenge(user.id, user.role as string, id);
  }

  /** PATCH /coach/roster/teams/:id/game – { enabled } (head coach). */
  @Patch('teams/:id/game')
  teamGame(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { enabled?: unknown },
  ) {
    return this.coach.setTeamGame(
      user.id,
      user.role as string,
      id,
      body?.enabled,
    );
  }

  @Get('teams/:id/league')
  league(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.coach.teamLeague(user.id, user.role as string, id);
  }
}
