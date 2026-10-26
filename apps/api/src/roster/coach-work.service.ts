import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PUSH_HOOKS, type PushHooks } from '../game/game-hooks';
import { AssignmentStatus, NoteVisibility } from '@challengepoint/db';
import { PrismaService } from '../prisma/prisma.service';
import { coachTeamsWhere } from '../teams/team-access';
import { feedbackWhere } from './roster.service';

const MAX_NOTE_LENGTH = 5000;
const ROLE_NAMES: Record<string, string> = {
  HEAD_COACH: 'Head coach',
  ASSISTANT: 'Assistant coach',
  FITNESS: 'Fitness coach',
  MENTAL: 'Mental coach',
};
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
  mentionIds: true,
  isHandover: true,
  createdAt: true,
  updatedAt: true,
  coachId: true,
  coach: { select: { id: true, firstName: true, lastName: true } },
} as const;

type NoteRow = {
  id: string;
  body: string;
  visibility: NoteVisibility;
  mentionIds: string[];
  isHandover: boolean;
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
    isHandover: row.isHandover,
    mentionIds: row.mentionIds,
    mentionsMe: row.mentionIds.includes(viewerId),
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
  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(PUSH_HOOKS) private readonly push?: PushHooks,
  ) {}

  /**
   * Coaches who work with a player: linked coaches (with their role) and the
   * head coach and staff of the player's teams.
   */
  async playerCoaches(viewerId: string, playerId: string) {
    await this.assertCoachCanSeePlayer(viewerId, playerId);
    const [links, memberships] = await Promise.all([
      this.prisma.coachPlayerLink.findMany({
        where: { playerId },
        select: {
          role: true,
          coach: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profileImage: true,
            },
          },
        },
      }),
      this.prisma.teamMember.findMany({
        where: { userId: playerId },
        select: {
          team: {
            select: {
              shortName: true,
              coach: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  profileImage: true,
                },
              },
              staff: {
                select: {
                  role: true,
                  coach: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      profileImage: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);
    const map = new Map<
      string,
      {
        id: string;
        firstName: string | null;
        lastName: string | null;
        profileImage: string | null;
        roles: string[];
      }
    >();
    const add = (
      coach: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        profileImage: string | null;
      },
      role: string,
    ) => {
      const entry = map.get(coach.id) ?? { ...coach, roles: [] };
      if (role && !entry.roles.includes(role)) entry.roles.push(role);
      map.set(coach.id, entry);
    };
    for (const link of links)
      add(link.coach, ROLE_NAMES[link.role ?? ''] ?? '');
    for (const { team } of memberships) {
      add(team.coach, `Head coach · ${team.shortName}`);
      for (const member of team.staff) {
        add(
          member.coach,
          `${ROLE_NAMES[member.role] ?? 'Coach'} · ${team.shortName}`,
        );
      }
    }
    return [...map.values()].map((coach) => ({
      ...coach,
      isMe: coach.id === viewerId,
    }));
  }

  /** Ids of coaches of the player mentioned as @Firstname (or @First Last). */
  private async mentionedCoaches(
    authorId: string,
    playerId: string,
    body: string,
  ) {
    if (!body.includes('@')) return [];
    const coaches = await this.playerCoaches(authorId, playerId);
    const lower = body.toLowerCase();
    return coaches
      .filter((coach) => coach.id !== authorId && coach.firstName)
      .filter((coach) => {
        const full =
          `@${[coach.firstName, coach.lastName].filter(Boolean).join(' ')}`.toLowerCase();
        const first = `@${coach.firstName}`.toLowerCase();
        return [full, first].some((token) => {
          const index = lower.indexOf(token);
          if (index < 0) return false;
          const next = lower.charAt(index + token.length);
          return !next || !/[a-zäöüß0-9]/i.test(next);
        });
      })
      .map((coach) => coach.id);
  }

  private async notifyNote(
    authorId: string,
    playerId: string,
    noteBody: string,
    recipients: string[],
    handover: boolean,
  ) {
    if (!this.push || recipients.length === 0) return;
    const [author, player] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: authorId },
        select: { firstName: true },
      }),
      this.prisma.user.findUnique({
        where: { id: playerId },
        select: { firstName: true, lastName: true },
      }),
    ]);
    const playerName = [player?.firstName, player?.lastName]
      .filter(Boolean)
      .join(' ');
    this.push.notify(recipients, 'mentions', {
      title: handover
        ? `🤝 Handover from ${author?.firstName ?? 'a coach'}: ${playerName}`
        : `@ ${author?.firstName ?? 'A coach'} mentioned you · ${playerName}`,
      body: noteBody.slice(0, 200),
      url: '/dashboard',
      tag: `note-${playerId}`,
    });
  }

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
        stars: true,
        resultScore: true,
        practiceMinutes: true,
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profileImage: true,
          },
        },
        lesson: {
          select: {
            id: true,
            name: true,
            focusArea: true,
            durationMinutes: true,
            targetScore: true,
            targetAttempts: true,
          },
        },
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
      orderBy: [{ isHandover: 'desc' }, { createdAt: 'desc' }],
      select: NOTE_SELECT,
    });
    return rows.map((row) => toNote(row as NoteRow, coachId));
  }

  async createNote(
    coachId: string,
    playerId: string,
    body: unknown,
    visibility?: unknown,
    isHandover?: unknown,
  ) {
    await this.assertCoachCanSeePlayer(coachId, playerId);
    const text = cleanBody(body);
    const mentionIds = await this.mentionedCoaches(coachId, playerId, text);
    const handover = isHandover === true;
    // Mentions and handovers only make sense for the coaching team.
    const shared = mentionIds.length > 0 || handover;
    const row = await this.prisma.coachPlayerNote.create({
      data: {
        coachId,
        playerId,
        body: text,
        visibility: shared
          ? NoteVisibility.SHARED
          : (cleanVisibility(visibility) ?? NoteVisibility.PRIVATE),
        mentionIds,
        isHandover: handover,
      },
      select: NOTE_SELECT,
    });
    const recipients = handover
      ? (await this.playerCoaches(coachId, playerId))
          .filter((c) => !c.isMe)
          .map((c) => c.id)
      : mentionIds;
    void this.notifyNote(coachId, playerId, text, recipients, handover).catch(
      () => null,
    );
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
    isHandover?: unknown,
  ) {
    await this.ownNote(coachId, noteId);
    const current = await this.prisma.coachPlayerNote.findUnique({
      where: { id: noteId },
      select: {
        playerId: true,
        body: true,
        mentionIds: true,
        isHandover: true,
      },
    });
    if (!current) throw new NotFoundException('Note not found');
    const text = body !== undefined ? cleanBody(body) : current.body;
    const mentionIds = await this.mentionedCoaches(
      coachId,
      current.playerId,
      text,
    );
    const handover =
      isHandover === undefined ? current.isHandover : isHandover === true;
    let nextVisibility = cleanVisibility(visibility);
    if (mentionIds.length > 0 || handover)
      nextVisibility = NoteVisibility.SHARED;
    const row = await this.prisma.coachPlayerNote.update({
      where: { id: noteId },
      data: {
        body: text,
        mentionIds,
        isHandover: handover,
        ...(nextVisibility ? { visibility: nextVisibility } : {}),
      },
      select: NOTE_SELECT,
    });
    const fresh = mentionIds.filter((id) => !current.mentionIds.includes(id));
    const recipients =
      handover && !current.isHandover
        ? (await this.playerCoaches(coachId, current.playerId))
            .filter((c) => !c.isMe)
            .map((c) => c.id)
        : fresh;
    void this.notifyNote(
      coachId,
      current.playerId,
      text,
      recipients,
      handover && !current.isHandover,
    ).catch(() => null);
    return toNote(row as NoteRow, coachId);
  }

  async deleteNote(coachId: string, noteId: string) {
    await this.ownNote(coachId, noteId);
    await this.prisma.coachPlayerNote.delete({ where: { id: noteId } });
    return { id: noteId, deleted: true };
  }
}
