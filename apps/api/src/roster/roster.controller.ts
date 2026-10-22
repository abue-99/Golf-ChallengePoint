import {
  Body,
  Controller,
  Delete,
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
import { RosterService } from './roster.service';
import { CoachWorkService } from './coach-work.service';

function requireCoach(user: AuthenticatedUser) {
  const role = user.role as string;
  if (role !== 'COACH' && role !== 'ADMIN') {
    throw new ForbiddenException('Only coaches and admins have a roster');
  }
}

@Controller('coach/roster')
@UseGuards(JwtAuthGuard)
export class RosterController {
  constructor(
    private readonly rosterService: RosterService,
    private readonly coachWork: CoachWorkService,
  ) {}

  /** GET /coach/roster?tz=Europe/Berlin – the coach home page in one call. */
  @Get()
  getRoster(
    @CurrentUser() user: AuthenticatedUser,
    @Query('tz') timeZone?: string,
  ) {
    requireCoach(user);
    return this.rosterService.getRoster(user.id, timeZone);
  }

  /** Completed lessons the coach has not looked at yet. */
  @Get('feedback')
  listFeedback(
    @CurrentUser() user: AuthenticatedUser,
    @Query('playerId') playerId?: string,
  ) {
    requireCoach(user);
    return this.coachWork.listFeedback(user.id, playerId || undefined);
  }

  @Post('feedback/seen')
  markAllSeen(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { playerId?: string } = {},
  ) {
    requireCoach(user);
    return this.coachWork.markAllFeedbackSeen(
      user.id,
      body?.playerId || undefined,
    );
  }

  @Post('feedback/:assignmentId/seen')
  markSeen(
    @CurrentUser() user: AuthenticatedUser,
    @Param('assignmentId') assignmentId: string,
  ) {
    requireCoach(user);
    return this.coachWork.markFeedbackSeen(user.id, assignmentId);
  }

  /** Undo a bulk assignment made from the teams page. */
  @Post('undo')
  undo(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { lessonAssignmentIds?: unknown; planIds?: unknown },
  ) {
    requireCoach(user);
    return this.coachWork.undoAssignments(user.id, body ?? {});
  }

  @Get('players/:playerId/notes')
  listNotes(
    @CurrentUser() user: AuthenticatedUser,
    @Param('playerId') playerId: string,
  ) {
    requireCoach(user);
    return this.coachWork.listNotes(user.id, playerId);
  }

  @Post('players/:playerId/notes')
  createNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('playerId') playerId: string,
    @Body() body: { body?: unknown },
  ) {
    requireCoach(user);
    return this.coachWork.createNote(user.id, playerId, body?.body);
  }

  @Patch('notes/:noteId')
  updateNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('noteId') noteId: string,
    @Body() body: { body?: unknown },
  ) {
    requireCoach(user);
    return this.coachWork.updateNote(user.id, noteId, body?.body);
  }

  @Delete('notes/:noteId')
  deleteNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('noteId') noteId: string,
  ) {
    requireCoach(user);
    return this.coachWork.deleteNote(user.id, noteId);
  }
}
