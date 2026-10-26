import {
  Body,
  Controller,
  ForbiddenException,
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
import { GameService } from './game.service';
import { MissionService } from './mission.service';
import { TeamGameService } from './team-game.service';

function requirePlayer(user: AuthenticatedUser) {
  if (user.role !== 'PLAYER')
    throw new ForbiddenException('Only players play the game');
}

/** The player game: profile, missions, team. */
@Controller('game')
@UseGuards(JwtAuthGuard)
export class GameController {
  constructor(
    private readonly game: GameService,
    private readonly missions: MissionService,
    private readonly team: TeamGameService,
  ) {}

  /** GET /game/me?tz= – level, week, quests, badges, card, recent events. */
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser, @Query('tz') tz?: string) {
    requirePlayer(user);
    return this.game.me(user.id, tz);
  }

  /** PATCH /game/me/goal – { days: 1–7 } */
  @Patch('me/goal')
  goal(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { days?: unknown },
  ) {
    requirePlayer(user);
    return this.game.setWeeklyGoal(user.id, body?.days);
  }

  /** GET /game/path – inbox, journeys, side missions, next mission. */
  @Get('path')
  path(@CurrentUser() user: AuthenticatedUser) {
    requirePlayer(user);
    return this.missions.path(user.id);
  }

  /** POST /game/inbox/accept – { all?: true, journeyIds?: [], missionIds?: [] } */
  @Post('inbox/accept')
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { all?: unknown; journeyIds?: unknown; missionIds?: unknown },
  ) {
    requirePlayer(user);
    return this.missions.accept(user.id, body ?? {});
  }

  @Get('missions/:id')
  mission(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    requirePlayer(user);
    return this.missions.mission(user.id, id);
  }

  @Post('missions/:id/start')
  start(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    requirePlayer(user);
    return this.missions.start(user.id, id);
  }

  /** POST /game/missions/:id/complete – { resultScore?, practiceMinutes?, exercisesDone?, selfAssessment?, playerNotes? } */
  @Post('missions/:id/complete')
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    requirePlayer(user);
    return this.missions.complete(user.id, id, body ?? {});
  }

  @Get('reviews')
  reviews(@CurrentUser() user: AuthenticatedUser) {
    requirePlayer(user);
    return this.missions.reviews(user.id);
  }

  /** POST /game/reviews/seen – { assignmentId? } */
  @Post('reviews/seen')
  reviewsSeen(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { assignmentId?: unknown },
  ) {
    requirePlayer(user);
    return this.missions.markReviewsSeen(user.id, body?.assignmentId);
  }

  /** GET /game/team?tz= – leagues, team feed, challenges. */
  @Get('team')
  teamView(@CurrentUser() user: AuthenticatedUser, @Query('tz') tz?: string) {
    requirePlayer(user);
    return this.team.team(user.id, tz);
  }

  /** POST /game/kudos/:eventId – toggles kudos. */
  @Post('kudos/:eventId')
  kudos(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventId') eventId: string,
  ) {
    requirePlayer(user);
    return this.team.kudos(user.id, eventId);
  }

  /** POST /game/challenges/:id/entries – { score, note? } */
  @Post('challenges/:id/entries')
  enter(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { score?: unknown; note?: unknown },
  ) {
    requirePlayer(user);
    return this.team.enterChallenge(user.id, id, body ?? {});
  }
}
