import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
// Type-only import keeps this file free of the Prisma client at runtime
// (pure helpers here are unit-tested without a database).
import type { AttendanceStatus } from '@challengepoint/db';
import { PrismaService } from '../prisma/prisma.service';
import { findEffectiveOccurrence, loadSlotExceptions } from './occurrences';

const MAX_NOTE_LENGTH = 300;
const STATUSES = ['GOING', 'MAYBE', 'NOT_GOING'] as const;
export type AttendanceStatusValue = (typeof STATUSES)[number];

/** Stable id of one occurrence of a team training window. */
export function slotOccurrenceKey(slotId: string, start: Date) {
  return `slot:${slotId}:${start.toISOString()}`;
}

/** Team events have a single occurrence. */
export function eventOccurrenceKey(eventId: string) {
  return `event:${eventId}`;
}

export type AttendanceSummary = {
  going: number;
  maybe: number;
  notGoing: number;
  /** Team members without an answer yet. */
  open: number;
  members: number;
  responses: {
    playerId: string;
    status: AttendanceStatusValue;
    note: string | null;
  }[];
};

/**
 * Loads attendance summaries for a set of team occurrences in two queries.
 * `items` maps each occurrence key to the team whose members are expected.
 */
export async function loadAttendanceSummaries(
  prisma: PrismaService,
  items: { key: string; teamId: string }[],
): Promise<Map<string, AttendanceSummary>> {
  const result = new Map<string, AttendanceSummary>();
  if (items.length === 0) return result;

  const teamIds = [...new Set(items.map((item) => item.teamId))];
  const [members, answers] = await Promise.all([
    prisma.teamMember.findMany({
      where: { teamId: { in: teamIds } },
      select: { teamId: true, userId: true },
    }),
    prisma.attendance.findMany({
      where: { occurrenceKey: { in: items.map((item) => item.key) } },
      select: { occurrenceKey: true, playerId: true, status: true, note: true },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  const membersByTeam = new Map<string, Set<string>>();
  for (const member of members) {
    const set = membersByTeam.get(member.teamId) ?? new Set<string>();
    set.add(member.userId);
    membersByTeam.set(member.teamId, set);
  }

  for (const item of items) {
    const teamMembers = membersByTeam.get(item.teamId) ?? new Set<string>();
    // Only current members count; answers of players who left are ignored.
    const responses = answers
      .filter(
        (answer) =>
          answer.occurrenceKey === item.key && teamMembers.has(answer.playerId),
      )
      .map((answer) => ({
        playerId: answer.playerId,
        status: answer.status as AttendanceStatusValue,
        note: answer.note,
      }));
    const count = (status: AttendanceStatusValue) =>
      responses.filter((response) => response.status === status).length;
    result.set(item.key, {
      going: count('GOING'),
      maybe: count('MAYBE'),
      notGoing: count('NOT_GOING'),
      open: Math.max(0, teamMembers.size - responses.length),
      members: teamMembers.size,
      responses,
    });
  }
  return result;
}

/** Players answer "going / maybe / not going" for team trainings and events. */
@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async respond(
    userId: string,
    role: string,
    body: {
      practiceSlotId?: unknown;
      teamEventId?: unknown;
      occurrenceStart?: unknown;
      status?: unknown;
      note?: unknown;
    },
  ) {
    if (role !== 'PLAYER') {
      throw new ForbiddenException('Only players answer for themselves');
    }
    const status = body.status;
    if (
      typeof status !== 'string' ||
      !STATUSES.includes(status as AttendanceStatusValue)
    ) {
      throw new BadRequestException('Status must be GOING, MAYBE or NOT_GOING');
    }
    let note: string | null = null;
    if (body.note !== undefined && body.note !== null) {
      if (typeof body.note !== 'string') {
        throw new BadRequestException('Note must be text');
      }
      note = body.note.trim().slice(0, MAX_NOTE_LENGTH) || null;
    }
    // A reason only makes sense when not going or unsure.
    if (status === 'GOING') note = null;

    const target = await this.resolveOccurrence(userId, body);
    if (target.end.getTime() < Date.now()) {
      throw new BadRequestException('This session is already over');
    }

    const saved = await this.prisma.attendance.upsert({
      where: {
        playerId_occurrenceKey: {
          playerId: userId,
          occurrenceKey: target.key,
        },
      },
      create: {
        playerId: userId,
        practiceSlotId: target.practiceSlotId,
        teamEventId: target.teamEventId,
        occurrenceKey: target.key,
        occurrenceStart: target.start,
        status: status as AttendanceStatus,
        note,
      },
      update: { status: status as AttendanceStatus, note },
      select: {
        occurrenceKey: true,
        status: true,
        note: true,
        updatedAt: true,
      },
    });
    return saved;
  }

  private async resolveOccurrence(
    playerId: string,
    body: {
      practiceSlotId?: unknown;
      teamEventId?: unknown;
      occurrenceStart?: unknown;
    },
  ) {
    if (typeof body.teamEventId === 'string' && body.teamEventId) {
      const event = await this.prisma.teamEvent.findUnique({
        where: { id: body.teamEventId },
        select: { id: true, teamId: true, startTime: true, endTime: true },
      });
      if (!event) throw new NotFoundException('Team event not found');
      await this.assertMember(playerId, event.teamId);
      return {
        key: eventOccurrenceKey(event.id),
        practiceSlotId: null,
        teamEventId: event.id,
        start: event.startTime,
        end: event.endTime,
      };
    }

    if (typeof body.practiceSlotId !== 'string' || !body.practiceSlotId) {
      throw new BadRequestException(
        'practiceSlotId or teamEventId is required',
      );
    }
    if (typeof body.occurrenceStart !== 'string') {
      throw new BadRequestException('occurrenceStart is required');
    }
    const start = new Date(body.occurrenceStart);
    if (Number.isNaN(start.getTime())) {
      throw new BadRequestException('occurrenceStart is not a valid date');
    }
    const slot = await this.prisma.practiceSlot.findUnique({
      where: { id: body.practiceSlotId },
      select: {
        id: true,
        ownerType: true,
        teamId: true,
        startTime: true,
        endTime: true,
        recurrence: true,
        recurrenceEndDate: true,
      },
    });
    if (!slot || slot.ownerType !== 'TEAM' || !slot.teamId) {
      throw new NotFoundException('Team training not found');
    }
    await this.assertMember(playerId, slot.teamId);

    // The start must be a real occurrence of this (possibly recurring)
    // window – for a moved one its new time.
    const exceptions =
      (await loadSlotExceptions(this.prisma, [slot.id])).get(slot.id) ?? [];
    const match = findEffectiveOccurrence(slot, exceptions, start);
    if (!match) {
      throw new NotFoundException('This training does not take place then');
    }
    if (match.status === 'cancelled') {
      throw new BadRequestException('This training was cancelled');
    }
    return {
      key: slotOccurrenceKey(slot.id, match.start),
      practiceSlotId: slot.id,
      teamEventId: null,
      start: match.start,
      end: match.end,
    };
  }

  private async assertMember(playerId: string, teamId: string) {
    const membership = await this.prisma.teamMember.findFirst({
      where: { teamId, userId: playerId },
      select: { id: true },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this team');
    }
  }
}
