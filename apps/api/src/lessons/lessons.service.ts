import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
    filters: { status?: string; focusArea?: string },
  ) {
    this.requireCoachOrAdmin(role);
    return this.prisma.trainingLesson.findMany({
      where: {
        // Admins see all lessons; coaches see only their own
        ...(role === 'ADMIN' ? {} : { coachId: userId }),
        ...(filters.status ? { status: filters.status as any } : {}),
        ...(filters.focusArea
          ? { focusArea: filters.focusArea as any }
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
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Create ───────────────────────────────────────────────────────────────

  async createLesson(
    coachId: string,
    role: string,
    data: {
      name: string;
      durationMinutes: number;
      focusArea: string;
      location?: string;
      status?: string;
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
    return this.prisma.trainingLesson.create({
      data: {
        coachId,
        name: data.name,
        durationMinutes: data.durationMinutes,
        focusArea: data.focusArea as any,
        location: data.location,
        status: (data.status as any) ?? 'PLANNED',
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
    if (role !== 'ADMIN' && lesson.coachId !== userId) {
      throw new ForbiddenException('Not your lesson');
    }
    return lesson;
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  async updateLesson(
    userId: string,
    role: string,
    id: string,
    data: {
      name?: string;
      durationMinutes?: number;
      focusArea?: string;
      location?: string;
      status?: string;
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
    if (role !== 'ADMIN' && lesson.coachId !== userId) {
      throw new ForbiddenException('Not your lesson');
    }

    return this.prisma.trainingLesson.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.durationMinutes !== undefined
          ? { durationMinutes: data.durationMinutes }
          : {}),
        ...(data.focusArea !== undefined
          ? { focusArea: data.focusArea as any }
          : {}),
        ...(data.location !== undefined ? { location: data.location } : {}),
        ...(data.status !== undefined ? { status: data.status as any } : {}),
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
