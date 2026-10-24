import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AssignmentStatus, NoteVisibility } from '@challengepoint/db';
import { PrismaService } from '../prisma/prisma.service';
import { coachTeamsWhere } from '../teams/team-access';
import { feedbackWhere } from './roster.service';

const MAX_NOTE_LENGTH = 5000;
/** Assignments can only be undone shortly after they were created. */
export const UNDO_WINDOW_MS = 15 * 60 * 1000;
const MAX_UNDO_IDS = 500;

function idList(value: unknown) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((id) => typeof id !== 'string')) {
    throw new BadRequestException('Expected a list of ids');
  }
  const ids = [...new Set(value as string[])];
  if (ids.length > MAX_UNDO_IDS) {
    throw new BadRequestException('Too many ids');
  }
  return ids;
}

function cleanBody(body: unknown) {
  if (typeof body !== 'string') {
    throw new BadRequestException('Note text is required');
  }
  const trimmed = body.trim();
  if (!trimmed) throw new BadRequestException('Note text is required');
  if (trimmed.length > MAX_NOTE_LENGTH) {
    throw new BadRequestException(
      `Notes can have at most ${MAX_NOTE_LENGTH} characters`,
    );
  }
  return trimmed;
}

function cleanVisibility(value: unknown): NoteVisibility | undefined {
  if (value === undefined || value === null) return undefined;
  if (value === 'PRIVATE' || value === 'SHARED') return value as NoteVisibility;
  throw new BadRequestException('Visibility must be PRIVATE or SHARED');
}

const NOTE_SELECT = {
  id: true,
  body: true,
  visibility: true,
  createdAt: true,
  updatedAt: true,
  coachId: true,
  coach: { select: { id: true, firstName: true, lastName: true } },
} as const;

type NoteRow = {
  id: string;
  body: string;
  visibility: NoteVisibility;
  createdAt: Date;
  updatedAt: Date;
  coachId: string;
  coach: { id: string; firstName: string | null; lastName: string | null };
};

function toNote(row: NoteRow, viewerId: string) {
  return {
    id: row.id,
    body: row.body,
    visibility: row.visibility,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    mine: row.coachId === viewerId,
    author: {
      id: row.coach.id,
      firstName: row.coach.firstName,
      lastName: row.coach.lastName,
    },
  };
}

/** Feedback inbox and coach notes (private or shared) for the coach home page. */
@Injectable()
export class CoachWorkService {
  constructor(private readonly prisma: PrismaService) {}

  /** A coach may work with linked players and members of their own teams. */
  private async assertCoachCanSeePlayer(coachId: string, playerId: string) {
    const [link, membership] = await Promise.all([
      this.prisma.coachPlayerLink.findFirst({
        where: { coachId, playerId },
        select: { id: true },
      }),
      this.prisma.teamMember.findFirst({
        where: { userId: playerId, team: coachTeamsWhere(coachId) },
        select: { id: true },
      }),
    ]);
    if (!link && !membership) {
      throw new ForbiddenException('This player is not one of your players');
    }
  }

  // ── Feedback ─────────────────────────────────────────────────────────

  async listFeedback(coachId: string, playerId?: string) {
    const items = await this.prisma.lessonAssignment.findMany({
      where: { ...feedbackWhere(coachId), ...(playerId ? { playerId } : {}) },
      orderBy: { completedAt: 'desc' },
      take: 200,
      select: {
        id: true,
        completedAt: true,
        selfAssessment: true,
        playerNotes: true,
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profileImage: true,
          },
        },
        lesson: { select: { id: true, name: true, focusArea: true } },
        block: { select: { plan: { select: { id: true, name: true } } } },
      },
    });
    return items.map(({ block, ...item }) => ({
      ...item,
      plan: block?.plan ?? null,
    }));
  }

  async markFeedbackSeen(coachId: string, assignmentId: string) {
    const assignment = await this.prisma.lessonAssignment.findUnique({
      where: { id: assignmentId },
      select: { id: true, coachId: true },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    if (assignment.coachId !== coachId) {
      throw new ForbiddenException('Not your assignment');
    }
    await this.prisma.lessonAssignment.update({
      where: { id: assignmentId },
      data: { coachReviewedAt: new Date() },
    });
    return { id: assignmentId, seen: true };
  }

  async markAllFeedbackSeen(coachId: string, playerId?: string) {
    const result = await this.prisma.lessonAssignment.updateMany({
      where: { ...feedbackWhere(coachId), ...(playerId ? { playerId } : {}) },
      data: { coachReviewedAt: new Date() },
    });
    return { updated: result.count };
  }

  // ── Undo ─────────────────────────────────────────────────────────────

  /**
   * Removes assignments the coach just created (bulk assign → "Undo").
   * Only touches the coach's own rows that are younger than the undo window
   * and that the player has not started yet.
   */
  async undoAssignments(
    coachId: string,
    body: { lessonAssignmentIds?: unknown; planIds?: unknown },
  ) {
    const lessonAssignmentIds = idList(body?.lessonAssignmentIds);
    const planIds = idList(body?.planIds);
    const since = new Date(Date.now() - UNDO_WINDOW_MS);

    return this.prisma.$transaction(async (tx) => {
      const lessons = lessonAssignmentIds.length
        ? await tx.lessonAssignment.deleteMany({
            where: {
              id: { in: lessonAssignmentIds },
              coachId,
              createdAt: { gte: since },
              status: AssignmentStatus.NEW,
            },
          })
        : { count: 0 };

      let journeys = 0;
      if (planIds.length) {
        const plans = await tx.playerDevelopmentPlan.findMany({
          where: { id: { in: planIds }, coachId, createdAt: { gte: since } },
          select: { id: true },
        });
        const ownPlanIds = plans.map((plan) => plan.id);
        const startedPlans = ownPlanIds.length
          ? await tx.lessonAssignment.findMany({
              where: {
                block: { planId: { in: ownPlanIds } },
                status: { not: AssignmentStatus.NEW },
              },
              select: { block: { select: { planId: true } } },
            })
          : [];
        const started = new Set(
          startedPlans.map((entry) => entry.block?.planId).filter(Boolean),
        );
        const removable = ownPlanIds.filter((id) => !started.has(id));
        if (removable.length) {
          await tx.journeyTemplateAssignment.deleteMany({
            where: { playerPlanId: { in: removable }, coachId },
          });
          // Blocks and their lesson assignments cascade with the plan.
          const deleted = await tx.playerDevelopmentPlan.deleteMany({
            where: { id: { in: removable } },
          });
          journeys = deleted.count;
        }
      }

      return { lessonsRemoved: lessons.count, journeysRemoved: journeys };
    });
  }

  // ── Notes ────────────────────────────────────────────────────────────

  /**
   * Own notes plus notes other coaches of this player chose to share.
   * Shared notes are visible to every coach who may see the player.
   */
  async listNotes(coachId: string, playerId: string) {
    await this.assertCoachCanSeePlayer(coachId, playerId);
    const rows = await this.prisma.coachPlayerNote.findMany({
      where: {
        playerId,
        OR: [{ coachId }, { visibility: NoteVisibility.SHARED }],
      },
      orderBy: { createdAt: 'desc' },
      select: NOTE_SELECT,
    });
    return rows.map((row) => toNote(row as NoteRow, coachId));
  }

  async createNote(
    coachId: string,
    playerId: string,
    body: unknown,
    visibility?: unknown,
  ) {
    await this.assertCoachCanSeePlayer(coachId, playerId);
    const row = await this.prisma.coachPlayerNote.create({
      data: {
        coachId,
        playerId,
        body: cleanBody(body),
        visibility: cleanVisibility(visibility) ?? NoteVisibility.PRIVATE,
      },
      select: NOTE_SELECT,
    });
    return toNote(row as NoteRow, coachId);
  }

  private async ownNote(coachId: string, noteId: string) {
    const note = await this.prisma.coachPlayerNote.findUnique({
      where: { id: noteId },
      select: { id: true, coachId: true },
    });
    // Other coaches' notes are reported as missing, not as forbidden.
    if (!note || note.coachId !== coachId) {
      throw new NotFoundException('Note not found');
    }
    return note;
  }

  /** Only the author edits; text and visibility can be changed separately. */
  async updateNote(
    coachId: string,
    noteId: string,
    body: unknown,
    visibility?: unknown,
  ) {
    await this.ownNote(coachId, noteId);
    const nextVisibility = cleanVisibility(visibility);
    const row = await this.prisma.coachPlayerNote.update({
      where: { id: noteId },
      data: {
        ...(body !== undefined ? { body: cleanBody(body) } : {}),
        ...(nextVisibility ? { visibility: nextVisibility } : {}),
      },
      select: NOTE_SELECT,
    });
    return toNote(row as NoteRow, coachId);
  }

  async deleteNote(coachId: string, noteId: string) {
    await this.ownNote(coachId, noteId);
    await this.prisma.coachPlayerNote.delete({ where: { id: noteId } });
    return { id: noteId, deleted: true };
  }
}
