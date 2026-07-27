import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { LessonsService } from './lessons.service';

@Controller('lessons')
@UseGuards(JwtAuthGuard)
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  // ─── List lessons ─────────────────────────────────────────────────────────

  @Get()
  listLessons(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('focusArea') focusArea?: string,
    @Query('visibility') visibility?: string,
  ) {
    return this.lessonsService.listLessons(user.id, user.role as string, {
      status,
      focusArea,
      visibility,
    });
  }

  // ─── Players linked to this coach (for assignment dropdown) ───────────────

  @Get('players')
  listPlayers(@CurrentUser() user: AuthenticatedUser) {
    return this.lessonsService.listLinkedPlayers(user.id);
  }

  // ─── Create lesson ────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createLesson(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      name: string;
      durationMinutes: number;
      focusArea: string;
      location?: string;
      status?: string;
      visibility?: string;
      videoUrl?: string;
      playerId?: string;
      trainingObjective?: string;
      currentSituation?: string;
      targetOutcome?: string;
      priority?: string;
      plannedExercises?: string;
      successCriteria?: string;
      goalAchieved?: string;
      playerSelfAssessment?: number;
      coachRating?: number;
      afterSessionVideoUrl?: string;
      performanceScore?: number;
      comments?: string;
      keyLearnings?: string;
    },
  ) {
    return this.lessonsService.createLesson(user.id, user.role as string, body);
  }

  // ─── Get one lesson ───────────────────────────────────────────────────────

  @Get(':id')
  getLesson(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.lessonsService.getLesson(user.id, user.role as string, id);
  }

  // ─── Update lesson ────────────────────────────────────────────────────────

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  updateLesson(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      durationMinutes?: number;
      focusArea?: string;
      location?: string;
      status?: string;
      visibility?: string;
      videoUrl?: string;
      playerId?: string | null;
      trainingObjective?: string;
      currentSituation?: string;
      targetOutcome?: string;
      priority?: string | null;
      plannedExercises?: string;
      successCriteria?: string;
      goalAchieved?: string | null;
      playerSelfAssessment?: number | null;
      coachRating?: number | null;
      afterSessionVideoUrl?: string;
      performanceScore?: number | null;
      comments?: string;
      keyLearnings?: string;
    },
  ) {
    return this.lessonsService.updateLesson(
      user.id,
      user.role as string,
      id,
      body,
    );
  }

  // ─── Delete lesson ────────────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deleteLesson(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.lessonsService.deleteLesson(user.id, user.role as string, id);
  }
}
