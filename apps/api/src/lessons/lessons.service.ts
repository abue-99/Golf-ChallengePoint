import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  clubIdsOf,
  libraryVisibleWhere,
  parseLibraryVisibility,
  userCanSeeLibraryItem,
} from '../library/library-access';

const COACH_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService) {}

  private requireCoachOrAdmin(role: string) {
    if (role !== 'COACH' && role !== 'ADMIN') {
      throw new ForbiddenException(
        'Only coaches and admins can manage lessons',
      );
    }
  }

  // ─── List ─────────────────────────────────────────────────────────────────

  async listLessons(
    userId: string,
    role: string,
    filters: { status?: string; focusArea?: string; subCapability?: string; subSubCapability?: string; visibility?: string },
  ) {
    this.requireCoachOrAdmin(role);
    // Coaches see their own lessons, club lessons of coaches in their clubs
    // and public lessons; admins see all lessons.
    const where: any = {
      ...(filters.status ? { status: filters.status as any } : {}),
      ...(filters.focusArea ? { focusArea: filters.focusArea as any } : {}),
      ...(filters.subCapability ? { subCapability: filters.subCapability } : {}),
      ...(filters.subSubCapability ? { subSubCapability: filters.subSubCapability } : {}),
      ...(filters.visibility ? { visibility: filters.visibility as any } : {}),
    };
    if (role !== 'ADMIN') {
      where.OR = libraryVisibleWhere(
        userId,
        await clubIdsOf(this.prisma, userId),
      );
      if (filters.visibility === 'PRIVATE') {
        // If filtering for private only, restrict to own lessons
        delete where.OR;
        where.coachId = userId;
        where.visibility = 'PRIVATE';
      }
    }
    return this.prisma.trainingLesson.findMany({
      where,
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        coach: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Create ───────────────────────────────────────────────────────────────

  async createLesson(
    coachId: string,
    role: string,
    data: {
      name: string;
      description?: string;
      durationMinutes: number;
      focusArea: string;
      subCapability?: string;
      subSubCapability?: string;
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
    this.requireCoachOrAdmin(role);
    if (
      data.visibility !== undefined &&
      data.visibility !== null &&
      !parseLibraryVisibility(data.visibility)
    ) {
      throw new BadRequestException(
        'Visibility must be PRIVATE, CLUB or PUBLIC',
      );
    }
    return this.prisma.trainingLesson.create({
      data: {
        coachId,
        name: data.name,
        description: data.description,
        durationMinutes: data.durationMinutes,
        focusArea: data.focusArea as any,
        subCapability: data.subCapability ?? null,
        subSubCapability: data.subSubCapability ?? null,
        location: data.location,
        status: (data.status as any) ?? 'PLANNED',
        visibility: (data.visibility as any) ?? 'PRIVATE',
        videoUrl: data.videoUrl,
        playerId: data.playerId || null,
        trainingObjective: data.trainingObjective,
        currentSituation: data.currentSituation,
        targetOutcome: data.targetOutcome,
        priority: data.priority ? (data.priority as any) : null,
        plannedExercises: data.plannedExercises,
        successCriteria: data.successCriteria,
        goalAchieved: data.goalAchieved ? (data.goalAchieved as any) : null,
        playerSelfAssessment: data.playerSelfAssessment ?? null,
        coachRating: data.coachRating ?? null,
        afterSessionVideoUrl: data.afterSessionVideoUrl,
        performanceScore: data.performanceScore ?? null,
        comments: data.comments,
        keyLearnings: data.keyLearnings,
      },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        coach: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  // ─── Get one ──────────────────────────────────────────────────────────────

  async getLesson(userId: string, role: string, id: string) {
    this.requireCoachOrAdmin(role);
    const lesson = await this.prisma.trainingLesson.findUnique({
      where: { id },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        coach: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    // Own lessons, club lessons of coaches in the same club, public lessons.
    if (
      !(await userCanSeeLibraryItem(this.prisma, { id: userId, role }, lesson))
    ) {
      throw new ForbiddenException('Not authorized to view this lesson');
    }
    return lesson;
  }

  // ─── Copy (club / public library) ─────────────────────────────────────────

  /**
   * Copies a lesson the coach may see into the coach's own library
   * (private, without results), so it can be adapted.
   */
  async copyLesson(userId: string, role: string, id: string) {
    const lesson = await this.getLesson(userId, role, id);
    return this.prisma.trainingLesson.create({
      data: {
        coachId: userId,
        copiedFromId: lesson.id,
        name: lesson.name,
        description: lesson.description,
        durationMinutes: lesson.durationMinutes,
        focusArea: lesson.focusArea,
        subCapability: lesson.subCapability,
        subSubCapability: lesson.subSubCapability,
        location: lesson.location,
        status: 'PLANNED',
        visibility: 'PRIVATE',
        videoUrl: lesson.videoUrl,
        trainingObjective: lesson.trainingObjective,
        currentSituation: lesson.currentSituation,
        targetOutcome: lesson.targetOutcome,
        priority: lesson.priority,
        plannedExercises: lesson.plannedExercises,
        successCriteria: lesson.successCriteria,
      },
      include: { coach: { select: COACH_SELECT } },
    });
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  async updateLesson(
    userId: string,
    role: string,
    id: string,
    data: {
      name?: string;
      description?: string;
      durationMinutes?: number;
      focusArea?: string;
      subCapability?: string | null;
      subSubCapability?: string | null;
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
    this.requireCoachOrAdmin(role);
    const lesson = await this.prisma.trainingLesson.findUnique({
      where: { id },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    // Only the original creator (or admin) can edit any lesson
    if (role !== 'ADMIN' && lesson.coachId !== userId) {
      throw new ForbiddenException('Only the creator can edit this lesson');
    }
    if (
      data.visibility !== undefined &&
      data.visibility !== null &&
      !parseLibraryVisibility(data.visibility)
    ) {
      throw new BadRequestException(
        'Visibility must be PRIVATE, CLUB or PUBLIC',
      );
    }

    return this.prisma.trainingLesson.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.durationMinutes !== undefined
          ? { durationMinutes: data.durationMinutes }
          : {}),
        ...(data.focusArea !== undefined
          ? { focusArea: data.focusArea as any }
          : {}),
        ...(data.subCapability !== undefined
          ? { subCapability: data.subCapability || null }
          : {}),
        ...(data.subSubCapability !== undefined
          ? { subSubCapability: data.subSubCapability || null }
          : {}),
        ...(data.location !== undefined ? { location: data.location } : {}),
        ...(data.status !== undefined ? { status: data.status as any } : {}),
        ...(data.visibility !== undefined ? { visibility: data.visibility as any } : {}),
        ...(data.videoUrl !== undefined ? { videoUrl: data.videoUrl } : {}),
        ...(data.playerId !== undefined
          ? { playerId: data.playerId || null }
          : {}),
        ...(data.trainingObjective !== undefined
          ? { trainingObjective: data.trainingObjective }
          : {}),
        ...(data.currentSituation !== undefined
          ? { currentSituation: data.currentSituation }
          : {}),
        ...(data.targetOutcome !== undefined
          ? { targetOutcome: data.targetOutcome }
          : {}),
        ...(data.priority !== undefined
          ? { priority: data.priority ? (data.priority as any) : null }
          : {}),
        ...(data.plannedExercises !== undefined
          ? { plannedExercises: data.plannedExercises }
          : {}),
        ...(data.successCriteria !== undefined
          ? { successCriteria: data.successCriteria }
          : {}),
        ...(data.goalAchieved !== undefined
          ? {
              goalAchieved: data.goalAchieved
                ? (data.goalAchieved as any)
                : null,
            }
          : {}),
        ...(data.playerSelfAssessment !== undefined
          ? { playerSelfAssessment: data.playerSelfAssessment }
          : {}),
        ...(data.coachRating !== undefined
          ? { coachRating: data.coachRating }
          : {}),
        ...(data.afterSessionVideoUrl !== undefined
          ? { afterSessionVideoUrl: data.afterSessionVideoUrl }
          : {}),
        ...(data.performanceScore !== undefined
          ? { performanceScore: data.performanceScore }
          : {}),
        ...(data.comments !== undefined ? { comments: data.comments } : {}),
        ...(data.keyLearnings !== undefined
          ? { keyLearnings: data.keyLearnings }
          : {}),
      },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async deleteLesson(userId: string, role: string, id: string) {
    this.requireCoachOrAdmin(role);
    const lesson = await this.prisma.trainingLesson.findUnique({
      where: { id },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    if (role !== 'ADMIN' && lesson.coachId !== userId) {
      throw new ForbiddenException('Not your lesson');
    }
    await this.prisma.trainingLesson.delete({ where: { id } });
    return { ok: true };
  }

  // ─── Players list (for assignment dropdown) ───────────────────────────────

  async listLinkedPlayers(coachId: string) {
    const links = await this.prisma.coachPlayerLink.findMany({
      where: { coachId },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            playerProfile: { select: { handicap: true } },
          },
        },
      },
    });
    return links.map((l) => l.player);
  }
}
