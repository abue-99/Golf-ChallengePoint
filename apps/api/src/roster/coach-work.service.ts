import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { feedbackWhere } from './roster.service';

const MAX_NOTE_LENGTH = 5000;

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

/** Feedback inbox and private notes for the coach home page. */
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
        where: { userId: playerId, team: { coachId } },
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

  // ── Notes ────────────────────────────────────────────────────────────

  async listNotes(coachId: string, playerId: string) {
    await this.assertCoachCanSeePlayer(coachId, playerId);
    return this.prisma.coachPlayerNote.findMany({
      where: { coachId, playerId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, body: true, createdAt: true, updatedAt: true },
    });
  }

  async createNote(coachId: string, playerId: string, body: unknown) {
    await this.assertCoachCanSeePlayer(coachId, playerId);
    return this.prisma.coachPlayerNote.create({
      data: { coachId, playerId, body: cleanBody(body) },
      select: { id: true, body: true, createdAt: true, updatedAt: true },
    });
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

  async updateNote(coachId: string, noteId: string, body: unknown) {
    await this.ownNote(coachId, noteId);
    return this.prisma.coachPlayerNote.update({
      where: { id: noteId },
      data: { body: cleanBody(body) },
      select: { id: true, body: true, createdAt: true, updatedAt: true },
    });
  }

  async deleteNote(coachId: string, noteId: string) {
    await this.ownNote(coachId, noteId);
    await this.prisma.coachPlayerNote.delete({ where: { id: noteId } });
    return { id: noteId, deleted: true };
  }
}
