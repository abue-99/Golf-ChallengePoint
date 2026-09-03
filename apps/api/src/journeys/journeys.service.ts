import {
  AssignmentSourceType,
  AssignmentStatus,
  AssignmentTargetType,
  JourneyDifficulty,
  LessonPriority,
  OwnerType,
  type Prisma,
} from '@challengepoint/db';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type JourneyTemplateLessonInput = {
  lessonId: string;
  sortOrder?: number;
  isRequired?: boolean;
};

type UpsertJourneyTemplateInput = {
  name?: string;
  description?: string | null;
  category?: string | null;
  difficulty?: string | null;
  coverImageUrl?: string | null;
  lessons?: JourneyTemplateLessonInput[];
};

@Injectable()
export class JourneysService {
  constructor(private readonly prisma: PrismaService) {}

  private requireCoachOrAdmin(role: string) {
    if (role !== 'COACH' && role !== 'ADMIN') {
      throw new ForbiddenException(
        'Only coaches and admins can manage journey templates',
      );
    }
  }

  private async assertCoachPlayerLink(coachId: string, playerId: string) {
    const link = await this.prisma.coachPlayerLink.findFirst({
      where: { coachId, playerId },
      select: { id: true },
    });
    if (!link) throw new ForbiddenException('Not linked to this player');
  }

  private async assertCoachOwnsTeam(coachId: string, teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, coachId: true },
    });
    if (!team) throw new NotFoundException('Team not found');
    if (team.coachId !== coachId) throw new ForbiddenException('Not your team');
    return team;
  }

  private parseDifficulty(value?: string | null): JourneyDifficulty | null {
    if (!value) return null;
    if (value in JourneyDifficulty) {
      return value as JourneyDifficulty;
    }
    throw new BadRequestException('Invalid journey difficulty');
  }

  private includeTemplate() {
    return {
      lessons: {
        include: {
          lesson: {
            select: {
              id: true,
              name: true,
              focusArea: true,
              durationMinutes: true,
            },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
    } satisfies Prisma.JourneyTemplateInclude;
  }

  private async assertCoachCanUseLessons(
    tx: Prisma.TransactionClient,
    userId: string,
    role: string,
    lessons: JourneyTemplateLessonInput[],
  ) {
    const lessonIds = [...new Set(lessons.map((entry) => entry.lessonId).filter(Boolean))];
    if (lessonIds.length === 0) return;

    const found = await tx.trainingLesson.findMany({
      where: {
        id: { in: lessonIds },
        ...(role === 'ADMIN'
          ? {}
          : {
              OR: [{ coachId: userId }, { visibility: 'PUBLIC' }],
            }),
      },
      select: { id: true },
    });

    if (found.length !== lessonIds.length) {
      throw new BadRequestException('One or more lessons are not accessible');
    }
  }

  private normalizeLessonEntries(
    lessons: JourneyTemplateLessonInput[] | undefined,
  ): JourneyTemplateLessonInput[] {
    if (!lessons) return [];
    return lessons
      .filter((entry) => Boolean(entry.lessonId))
      .map((entry, index) => ({
        lessonId: entry.lessonId,
        sortOrder: entry.sortOrder ?? index,
        isRequired: Boolean(entry.isRequired),
      }))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  async listTemplates(userId: string, role: string) {
    this.requireCoachOrAdmin(role);
    return this.prisma.journeyTemplate.findMany({
      where: role === 'ADMIN' ? {} : { coachId: userId },
      include: this.includeTemplate(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTemplate(userId: string, role: string, id: string) {
    this.requireCoachOrAdmin(role);
    const template = await this.prisma.journeyTemplate.findUnique({
      where: { id },
      include: this.includeTemplate(),
    });
    if (!template) throw new NotFoundException('Journey template not found');
    if (role !== 'ADMIN' && template.coachId !== userId) {
      throw new ForbiddenException('Not your journey template');
    }
    return template;
  }

  async createTemplate(userId: string, role: string, data: UpsertJourneyTemplateInput) {
    this.requireCoachOrAdmin(role);
    const name = data.name?.trim();
    if (!name) throw new BadRequestException('name is required');

    const lessons = this.normalizeLessonEntries(data.lessons);
    return this.prisma.$transaction(async (tx) => {
      await this.assertCoachCanUseLessons(tx, userId, role, lessons);
      const template = await tx.journeyTemplate.create({
        data: {
          coachId: userId,
          name,
          description: data.description?.trim() || null,
          category: data.category?.trim() || null,
          difficulty: this.parseDifficulty(data.difficulty),
          coverImageUrl: data.coverImageUrl?.trim() || null,
          lessons: lessons.length
            ? {
                create: lessons.map((entry, index) => ({
                  lessonId: entry.lessonId,
                  sortOrder: entry.sortOrder ?? index,
                  isRequired: Boolean(entry.isRequired),
                })),
              }
            : undefined,
        },
        include: this.includeTemplate(),
      });
      return template;
    });
  }

  async updateTemplate(
    userId: string,
    role: string,
    id: string,
    data: UpsertJourneyTemplateInput,
  ) {
    this.requireCoachOrAdmin(role);

    const existing = await this.prisma.journeyTemplate.findUnique({
      where: { id },
      select: { id: true, coachId: true },
    });
    if (!existing) throw new NotFoundException('Journey template not found');
    if (role !== 'ADMIN' && existing.coachId !== userId) {
      throw new ForbiddenException('Not your journey template');
    }

    const lessons =
      data.lessons !== undefined ? this.normalizeLessonEntries(data.lessons) : undefined;

    return this.prisma.$transaction(async (tx) => {
      if (lessons !== undefined) {
        await this.assertCoachCanUseLessons(tx, userId, role, lessons);
      }

      if (lessons !== undefined) {
        await tx.journeyTemplateLesson.deleteMany({
          where: { journeyTemplateId: id },
        });
      }

      return tx.journeyTemplate.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name.trim() } : {}),
          ...(data.description !== undefined
            ? { description: data.description?.trim() || null }
            : {}),
          ...(data.category !== undefined ? { category: data.category?.trim() || null } : {}),
          ...(data.difficulty !== undefined
            ? { difficulty: this.parseDifficulty(data.difficulty) }
            : {}),
          ...(data.coverImageUrl !== undefined
            ? { coverImageUrl: data.coverImageUrl?.trim() || null }
            : {}),
          ...(lessons !== undefined
            ? {
                lessons: {
                  create: lessons.map((entry, index) => ({
                    lessonId: entry.lessonId,
                    sortOrder: entry.sortOrder ?? index,
                    isRequired: Boolean(entry.isRequired),
                  })),
                },
              }
            : {}),
        },
        include: this.includeTemplate(),
      });
    });
  }

  async duplicateTemplate(userId: string, role: string, id: string) {
    const template = await this.getTemplate(userId, role, id);
    return this.prisma.journeyTemplate.create({
      data: {
        coachId: userId,
        name: `${template.name} (Copy)`,
        description: template.description,
        category: template.category,
        difficulty: template.difficulty,
        coverImageUrl: template.coverImageUrl,
        lessons: {
          create: template.lessons.map((entry, index) => ({
            lessonId: entry.lessonId,
            sortOrder: entry.sortOrder ?? index,
            isRequired: entry.isRequired,
          })),
        },
      },
      include: this.includeTemplate(),
    });
  }

  async deleteTemplate(userId: string, role: string, id: string) {
    const template = await this.getTemplate(userId, role, id);
    await this.prisma.journeyTemplate.delete({ where: { id: template.id } });
    return { ok: true };
  }

  private async createPlayerJourneyFromTemplate(
    tx: Prisma.TransactionClient,
    input: {
      template: {
        id: string;
        name: string;
        description: string | null;
        lessons: {
          lessonId: string;
          sortOrder: number;
          isRequired: boolean;
        }[];
      };
      coachId: string;
      playerId: string;
      teamId?: string | null;
    },
  ) {
    const { template, coachId, playerId, teamId } = input;

    const plan = await tx.playerDevelopmentPlan.create({
      data: {
        name: template.name,
        description: template.description,
        coachId,
        ownerType: OwnerType.PLAYER,
        playerId,
      },
      select: { id: true },
    });

    const block = await tx.trainingBlock.create({
      data: {
        planId: plan.id,
        coachId,
        name: `${template.name} Lessons`,
        description: template.description,
        sortOrder: 0,
      },
      select: { id: true },
    });

    if (template.lessons.length > 0) {
      await tx.lessonAssignment.createMany({
        data: template.lessons.map((entry, index) => ({
          blockId: block.id,
          lessonId: entry.lessonId,
          targetType: AssignmentTargetType.PLAYER,
          sourceType: teamId ? AssignmentSourceType.TEAM : AssignmentSourceType.PLAYER,
          sourceReference: teamId ?? playerId,
          playerId,
          teamId: teamId ?? null,
          coachId,
          priority: LessonPriority.MEDIUM,
          status: AssignmentStatus.NEW,
          sortOrder: entry.sortOrder ?? index,
          isInTrainingQueue: false,
        })),
      });
    }

    const queueAssignment = await tx.journeyTemplateAssignment.create({
      data: {
        journeyTemplateId: template.id,
        playerId,
        teamId: teamId ?? null,
        coachId,
        playerPlanId: plan.id,
        status: AssignmentStatus.NEW,
        isInTrainingQueue: true,
        source: 'assignedByCoach',
      },
    });

    return {
      queueAssignment,
      playerPlanId: plan.id,
      journeyTemplate: {
        id: template.id,
        name: template.name,
      },
    };
  }

  async assignTemplateToPlayer(
    coachId: string,
    role: string,
    journeyId: string,
    playerId: string,
  ) {
    this.requireCoachOrAdmin(role);
    if (role !== 'ADMIN') await this.assertCoachPlayerLink(coachId, playerId);

    const template = await this.prisma.journeyTemplate.findUnique({
      where: { id: journeyId },
      include: {
        lessons: {
          select: { lessonId: true, sortOrder: true, isRequired: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!template) throw new NotFoundException('Journey template not found');
    if (role !== 'ADMIN' && template.coachId !== coachId) {
      throw new ForbiddenException('Not your journey template');
    }

    return this.prisma.$transaction((tx) =>
      this.createPlayerJourneyFromTemplate(tx, {
        template,
        coachId,
        playerId,
      }),
    );
  }

  async assignTemplateToTeam(
    coachId: string,
    role: string,
    journeyId: string,
    teamId: string,
  ) {
    this.requireCoachOrAdmin(role);
    if (role !== 'ADMIN') await this.assertCoachOwnsTeam(coachId, teamId);

    const template = await this.prisma.journeyTemplate.findUnique({
      where: { id: journeyId },
      include: {
        lessons: {
          select: { lessonId: true, sortOrder: true, isRequired: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!template) throw new NotFoundException('Journey template not found');
    if (role !== 'ADMIN' && template.coachId !== coachId) {
      throw new ForbiddenException('Not your journey template');
    }

    const members = await this.prisma.teamMember.findMany({
      where: { teamId, user: { role: 'PLAYER' } },
      select: { userId: true },
    });
    const uniquePlayerIds = [...new Set(members.map((entry) => entry.userId))];

    if (uniquePlayerIds.length === 0) {
      return {
        journeyTemplateId: journeyId,
        journeyTemplate: { id: template.id, name: template.name },
        teamId,
        playersAffected: 0,
        assignmentsCreated: 0,
        assignments: [],
      };
    }

    return this.prisma.$transaction(async (tx) => {
      const created = await Promise.all(
        uniquePlayerIds.map((memberPlayerId) =>
          this.createPlayerJourneyFromTemplate(tx, {
            template,
            coachId,
            playerId: memberPlayerId,
            teamId,
          }),
        ),
      );

      return {
        journeyTemplateId: journeyId,
        journeyTemplate: { id: template.id, name: template.name },
        teamId,
        playersAffected: uniquePlayerIds.length,
        assignmentsCreated: created.length,
        assignments: created.map((entry) => ({
          id: entry.queueAssignment.id,
          playerId: entry.queueAssignment.playerId,
          playerPlanId: entry.playerPlanId,
        })),
      };
    });
  }

  async updateJourneyAssignment(
    userId: string,
    role: string,
    assignmentId: string,
    data: { status?: string; isInTrainingQueue?: boolean },
  ) {
    const assignment = await this.prisma.journeyTemplateAssignment.findUnique({
      where: { id: assignmentId },
      select: { id: true, playerId: true, coachId: true },
    });
    if (!assignment) throw new NotFoundException('Journey assignment not found');

    const isCoachOrAdmin = role === 'COACH' || role === 'ADMIN';
    if (isCoachOrAdmin) {
      if (role !== 'ADMIN' && assignment.coachId !== userId) {
        throw new ForbiddenException('Not your journey assignment');
      }
    } else if (assignment.playerId !== userId) {
      throw new ForbiddenException('Not your journey assignment');
    }

    return this.prisma.journeyTemplateAssignment.update({
      where: { id: assignmentId },
      data: {
        ...(data.status !== undefined
          ? { status: data.status as AssignmentStatus }
          : {}),
        ...(data.isInTrainingQueue !== undefined
          ? { isInTrainingQueue: Boolean(data.isInTrainingQueue) }
          : {}),
      },
      include: {
        journeyTemplate: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }
}
