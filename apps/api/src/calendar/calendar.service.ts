import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OwnerType } from '@challengepoint/db';

type RecurrenceValue = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
type AvailabilityType = 'SCHOOL' | 'WORK' | 'HOLIDAY' | 'TRAVEL' | 'CUSTOM';
type TournamentPriority = 'PRIORITY_1' | 'PRIORITY_2' | 'PRIORITY_3';
type CalendarTaskStatus = 'PLANNED' | 'COMPLETED';
type DevelopmentMilestoneStatus = 'PLANNED' | 'COMPLETED';

export interface SlotOccurrence {
  start: Date;
  end: Date;
}

interface RawSlot {
  id: string;
  ownerType: OwnerType;
  playerId: string | null;
  teamId: string | null;
  team: { id: string; shortName: string; icon: string | null } | null;
  title: string;
  recurrence: string;
  recurrenceEndDate: Date | null;
  startTime: Date;
  endTime: Date;
  tasks: unknown[];
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

function addRecurringStep(date: Date, recurrence: string) {
  switch (recurrence) {
    case 'DAILY':
      date.setDate(date.getDate() + 1);
      break;
    case 'WEEKLY':
      date.setDate(date.getDate() + 7);
      break;
    case 'MONTHLY':
      date.setMonth(date.getMonth() + 1);
      break;
  }
}

function expandRecurringOccurrences(
  range: {
    startTime: Date;
    endTime: Date;
    recurrence: string;
    recurrenceEndDate: Date | null;
  },
  limit: Date,
): SlotOccurrence[] {
  const duration = range.endTime.getTime() - range.startTime.getTime();

  if (range.recurrence === 'NONE') {
    return [{ start: new Date(range.startTime), end: new Date(range.endTime) }];
  }

  const upperBound = range.recurrenceEndDate
    ? new Date(Math.min(range.recurrenceEndDate.getTime(), limit.getTime()))
    : limit;

  const occurrences: SlotOccurrence[] = [];
  const current = new Date(range.startTime);

  while (current <= upperBound && occurrences.length < 500) {
    occurrences.push({
      start: new Date(current),
      end: new Date(current.getTime() + duration),
    });
    addRecurringStep(current, range.recurrence);
  }

  return occurrences;
}

function getDefaultExpansionLimit(base: Date) {
  const limit = new Date(base);
  limit.setMonth(limit.getMonth() + 6);
  return limit;
}

function formatWindow(start: Date, end: Date) {
  const date = start.toLocaleDateString();
  const startTime = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const endTime = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} ${startTime}-${endTime}`;
}

function startOfWeek(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  const diff = (day + 6) % 7;
  start.setDate(start.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  private validateDateRange(start: Date, end: Date, message = 'Start time must be before end time') {
    if (!(start instanceof Date) || Number.isNaN(start.getTime()) || !(end instanceof Date) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date value');
    }
    if (start >= end) {
      throw new BadRequestException(message);
    }
  }

  private async assertCoachPlayerLink(coachId: string, playerId: string) {
    const link = await this.prisma.coachPlayerLink.findFirst({
      where: { coachId, playerId },
    });
    if (!link) {
      throw new ForbiddenException('Not linked to this player');
    }
  }

  private requireCoachOrAdmin(role: string) {
    if (role !== 'COACH' && role !== 'ADMIN') {
      throw new ForbiddenException('Only coaches and admins can manage team training windows');
    }
  }

  private async assertCoachOwnsTeam(coachId: string, teamId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Team not found');
    if (team.coachId !== coachId) throw new ForbiddenException('Not your team');
    return team;
  }

  private async assertCanAccessPlayer(userId: string, role: string, playerId: string) {
    if (userId === playerId || role === 'ADMIN') return;
    await this.assertCoachPlayerLink(userId, playerId);
  }

  private async getActiveTeamIdsForPlayer(playerId: string) {
    const memberships = await this.prisma.teamMember.findMany({
      where: { userId: playerId },
      select: { teamId: true },
    });
    return memberships.map((membership) => membership.teamId);
  }

  private async getActivePlayerIdsForTeam(teamId: string) {
    const memberships = await this.prisma.teamMember.findMany({
      where: { teamId },
      select: { userId: true },
    });
    return memberships.map((membership) => membership.userId);
  }

  private expandSlot(slot: RawSlot) {
    const limit = getDefaultExpansionLimit(new Date(slot.startTime));
    return {
      id: slot.id,
      ownerType: slot.ownerType,
      playerId: slot.playerId,
      teamId: slot.teamId,
      team: slot.team,
      title: slot.title,
      recurrence: slot.recurrence,
      recurrenceEndDate: slot.recurrenceEndDate,
      occurrences: expandRecurringOccurrences(slot, limit),
      tasks: slot.tasks,
    };
  }

  private async ensureNoAvailabilityConflicts(
    playerIds: string[],
    intervals: SlotOccurrence[],
    ignoreAvailabilityBlockId?: string,
  ) {
    if (playerIds.length === 0 || intervals.length === 0) return;

    const latestEnd = intervals.reduce(
      (max, interval) => (interval.end.getTime() > max.getTime() ? interval.end : max),
      intervals[0].end,
    );

    const blocks = await this.prisma.availabilityBlock.findMany({
      where: {
        playerId: { in: playerIds },
        ...(ignoreAvailabilityBlockId ? { id: { not: ignoreAvailabilityBlockId } } : {}),
      },
      select: {
        id: true,
        title: true,
        type: true,
        startTime: true,
        endTime: true,
        recurrence: true,
        recurrenceEndDate: true,
        player: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    const conflictMessages: string[] = [];

    for (const block of blocks) {
      const occurrences = expandRecurringOccurrences(block, latestEnd);
      for (const occurrence of occurrences) {
        const interval = intervals.find((candidate) =>
          overlaps(candidate.start, candidate.end, occurrence.start, occurrence.end),
        );
        if (!interval) continue;
        const playerName =
          [block.player.firstName, block.player.lastName].filter(Boolean).join(' ') || block.player.email;
        conflictMessages.push(
          `${playerName}: ${block.title} (${block.type}) at ${formatWindow(occurrence.start, occurrence.end)}`,
        );
        break;
      }
      if (conflictMessages.length >= 5) break;
    }

    if (conflictMessages.length > 0) {
      throw new BadRequestException(`Scheduling conflict with blackout time: ${conflictMessages.join('; ')}`);
    }
  }

  private async getPlayerIdsForSlot(slotId: string) {
    const slot = await this.prisma.practiceSlot.findUnique({
      where: { id: slotId },
      select: { ownerType: true, playerId: true, teamId: true },
    });
    if (!slot) throw new NotFoundException('Practice slot not found');
    if (slot.ownerType === OwnerType.PLAYER) {
      return slot.playerId ? [slot.playerId] : [];
    }
    return slot.teamId ? this.getActivePlayerIdsForTeam(slot.teamId) : [];
  }

  private buildTaskIntervals(
    starts: Date[],
    durationMinutes: number,
  ) {
    return starts.map((start) => ({
      start,
      end: new Date(start.getTime() + durationMinutes * 60_000),
    }));
  }

  async listSlots(userId: string, role: string, playerId?: string) {
    const targetId = playerId ?? userId;
    await this.assertCanAccessPlayer(userId, role, targetId);

    const activeTeamIds = await this.getActiveTeamIdsForPlayer(targetId);

    return this.prisma.practiceSlot.findMany({
      where: {
        OR: [
          { ownerType: OwnerType.PLAYER, playerId: targetId },
          ...(activeTeamIds.length > 0
            ? [{ ownerType: OwnerType.TEAM, teamId: { in: activeTeamIds } }]
            : []),
        ],
      },
      include: {
        team: { select: { id: true, shortName: true, icon: true } },
        tasks: {
          include: {
            lesson: {
              select: {
                id: true,
                focusArea: true,
                trainingObjective: true,
                successCriteria: true,
                plannedExercises: true,
              },
            },
          },
        },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async createSlot(
    userId: string,
    data: {
      title: string;
      startTime: string;
      endTime: string;
      recurrence?: RecurrenceValue;
      recurrenceEndDate?: string;
    },
  ) {
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);
    this.validateDateRange(startTime, endTime);

    const recurrenceEndDate = data.recurrenceEndDate ? new Date(data.recurrenceEndDate) : null;
    const conflictLimit = recurrenceEndDate ?? getDefaultExpansionLimit(startTime);
    const intervals = expandRecurringOccurrences(
      {
        startTime,
        endTime,
        recurrence: data.recurrence ?? 'NONE',
        recurrenceEndDate,
      },
      conflictLimit,
    );
    await this.ensureNoAvailabilityConflicts([userId], intervals);

    return this.prisma.practiceSlot.create({
      data: {
        ownerType: OwnerType.PLAYER,
        playerId: userId,
        teamId: null,
        title: data.title,
        startTime,
        endTime,
        recurrence: data.recurrence ?? 'NONE',
        recurrenceEndDate,
      },
      include: { team: { select: { id: true, shortName: true, icon: true } } },
    });
  }

  async listTeamSlots(userId: string, role: string, teamId: string) {
    this.requireCoachOrAdmin(role);
    if (role !== 'ADMIN') {
      await this.assertCoachOwnsTeam(userId, teamId);
    }
    const slots = await this.prisma.practiceSlot.findMany({
      where: { ownerType: OwnerType.TEAM, teamId },
      include: {
        tasks: {
          include: {
            lesson: {
              select: {
                id: true,
                focusArea: true,
                trainingObjective: true,
                successCriteria: true,
                plannedExercises: true,
              },
            },
          },
        },
        team: { select: { id: true, shortName: true, icon: true } },
      },
      orderBy: { startTime: 'asc' },
    });
    return slots.map((slot) => this.expandSlot(slot));
  }

  async createTeamSlot(
    userId: string,
    role: string,
    teamId: string,
    data: {
      title: string;
      startTime: string;
      endTime: string;
      recurrence?: RecurrenceValue;
      recurrenceEndDate?: string;
    },
  ) {
    this.requireCoachOrAdmin(role);
    if (role !== 'ADMIN') {
      await this.assertCoachOwnsTeam(userId, teamId);
    }

    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);
    this.validateDateRange(startTime, endTime);

    const recurrenceEndDate = data.recurrenceEndDate ? new Date(data.recurrenceEndDate) : null;
    const conflictLimit = recurrenceEndDate ?? getDefaultExpansionLimit(startTime);
    const intervals = expandRecurringOccurrences(
      {
        startTime,
        endTime,
        recurrence: data.recurrence ?? 'NONE',
        recurrenceEndDate,
      },
      conflictLimit,
    );
    const playerIds = await this.getActivePlayerIdsForTeam(teamId);
    await this.ensureNoAvailabilityConflicts(playerIds, intervals);

    const slot = await this.prisma.practiceSlot.create({
      data: {
        ownerType: OwnerType.TEAM,
        playerId: null,
        teamId,
        title: data.title,
        startTime,
        endTime,
        recurrence: data.recurrence ?? 'NONE',
        recurrenceEndDate,
      },
      include: {
        tasks: true,
        team: { select: { id: true, shortName: true, icon: true } },
      },
    });
    return this.expandSlot(slot);
  }

  async updateSlot(
    userId: string,
    role: string,
    slotId: string,
    data: {
      title?: string;
      startTime?: string;
      endTime?: string;
      recurrence?: RecurrenceValue;
      recurrenceEndDate?: string | null;
    },
  ) {
    const slot = await this.prisma.practiceSlot.findUnique({
      where: { id: slotId },
      include: { team: true },
    });
    if (!slot) throw new NotFoundException('Practice slot not found');
    if (slot.ownerType === OwnerType.TEAM) {
      this.requireCoachOrAdmin(role);
      if (role !== 'ADMIN' && slot.teamId) {
        await this.assertCoachOwnsTeam(userId, slot.teamId);
      }
    } else if (slot.playerId !== userId) {
      throw new ForbiddenException('Not your practice slot');
    }

    const startTime = data.startTime ? new Date(data.startTime) : slot.startTime;
    const endTime = data.endTime ? new Date(data.endTime) : slot.endTime;
    this.validateDateRange(startTime, endTime);
    const recurrence = data.recurrence ?? (slot.recurrence as RecurrenceValue);
    const recurrenceEndDate =
      data.recurrenceEndDate !== undefined
        ? data.recurrenceEndDate
          ? new Date(data.recurrenceEndDate)
          : null
        : slot.recurrenceEndDate;

    const conflictLimit = recurrenceEndDate ?? getDefaultExpansionLimit(startTime);
    const intervals = expandRecurringOccurrences(
      {
        startTime,
        endTime,
        recurrence,
        recurrenceEndDate,
      },
      conflictLimit,
    );
    const affectedPlayerIds =
      slot.ownerType === OwnerType.TEAM && slot.teamId
        ? await this.getActivePlayerIdsForTeam(slot.teamId)
        : slot.playerId
          ? [slot.playerId]
          : [];
    await this.ensureNoAvailabilityConflicts(affectedPlayerIds, intervals);

    return this.prisma.practiceSlot.update({
      where: { id: slotId },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.startTime !== undefined ? { startTime } : {}),
        ...(data.endTime !== undefined ? { endTime } : {}),
        ...(data.recurrence !== undefined ? { recurrence } : {}),
        ...(data.recurrenceEndDate !== undefined ? { recurrenceEndDate } : {}),
      },
      include: { team: { select: { id: true, shortName: true, icon: true } } },
    });
  }

  async deleteSlot(userId: string, role: string, slotId: string) {
    const slot = await this.prisma.practiceSlot.findUnique({
      where: { id: slotId },
      include: { team: true },
    });
    if (!slot) throw new NotFoundException('Practice slot not found');
    if (slot.ownerType === OwnerType.TEAM) {
      this.requireCoachOrAdmin(role);
      if (role !== 'ADMIN' && slot.teamId) {
        await this.assertCoachOwnsTeam(userId, slot.teamId);
      }
    } else if (slot.playerId !== userId) {
      throw new ForbiddenException('Not your practice slot');
    }

    await this.prisma.practiceSlot.delete({ where: { id: slotId } });
    return { ok: true };
  }

  async listAvailabilityBlocks(userId: string, role: string, playerId?: string) {
    const targetPlayerId = playerId ?? userId;
    await this.assertCanAccessPlayer(userId, role, targetPlayerId);
    return this.prisma.availabilityBlock.findMany({
      where: { playerId: targetPlayerId },
      orderBy: { startTime: 'asc' },
    });
  }

  async createAvailabilityBlock(
    userId: string,
    role: string,
    data: {
      playerId?: string;
      title: string;
      type?: AvailabilityType;
      startTime: string;
      endTime: string;
      recurrence?: RecurrenceValue;
      recurrenceEndDate?: string;
      notes?: string;
    },
  ) {
    const playerId = data.playerId ?? userId;
    await this.assertCanAccessPlayer(userId, role, playerId);
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);
    this.validateDateRange(startTime, endTime);

    return this.prisma.availabilityBlock.create({
      data: {
        playerId,
        title: data.title,
        type: data.type ?? 'CUSTOM',
        startTime,
        endTime,
        recurrence: data.recurrence ?? 'NONE',
        recurrenceEndDate: data.recurrenceEndDate ? new Date(data.recurrenceEndDate) : null,
        notes: data.notes,
      },
    });
  }

  async updateAvailabilityBlock(
    userId: string,
    role: string,
    blockId: string,
    data: {
      title?: string;
      type?: AvailabilityType;
      startTime?: string;
      endTime?: string;
      recurrence?: RecurrenceValue;
      recurrenceEndDate?: string | null;
      notes?: string | null;
    },
  ) {
    const block = await this.prisma.availabilityBlock.findUnique({ where: { id: blockId } });
    if (!block) throw new NotFoundException('Availability block not found');
    await this.assertCanAccessPlayer(userId, role, block.playerId);

    const startTime = data.startTime ? new Date(data.startTime) : block.startTime;
    const endTime = data.endTime ? new Date(data.endTime) : block.endTime;
    this.validateDateRange(startTime, endTime);

    return this.prisma.availabilityBlock.update({
      where: { id: blockId },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.startTime !== undefined ? { startTime } : {}),
        ...(data.endTime !== undefined ? { endTime } : {}),
        ...(data.recurrence !== undefined ? { recurrence: data.recurrence } : {}),
        ...(data.recurrenceEndDate !== undefined
          ? {
              recurrenceEndDate: data.recurrenceEndDate
                ? new Date(data.recurrenceEndDate)
                : null,
            }
          : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
    });
  }

  async deleteAvailabilityBlock(userId: string, role: string, blockId: string) {
    const block = await this.prisma.availabilityBlock.findUnique({ where: { id: blockId } });
    if (!block) throw new NotFoundException('Availability block not found');
    await this.assertCanAccessPlayer(userId, role, block.playerId);
    await this.prisma.availabilityBlock.delete({ where: { id: blockId } });
    return { ok: true };
  }

  async listTeamEvents(userId: string, role: string, teamId?: string) {
    this.requireCoachOrAdmin(role);
    if (teamId && role !== 'ADMIN') {
      await this.assertCoachOwnsTeam(userId, teamId);
    }
    return this.prisma.teamEvent.findMany({
      where: teamId ? { teamId } : role === 'ADMIN' ? {} : { coachId: userId },
      orderBy: { startTime: 'asc' },
    });
  }

  async createTeamEvent(
    userId: string,
    role: string,
    data: {
      teamId: string;
      title: string;
      description?: string;
      location?: string;
      startTime: string;
      endTime: string;
    },
  ) {
    this.requireCoachOrAdmin(role);
    if (role !== 'ADMIN') {
      await this.assertCoachOwnsTeam(userId, data.teamId);
    }
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);
    this.validateDateRange(startTime, endTime);
    const playerIds = await this.getActivePlayerIdsForTeam(data.teamId);
    await this.ensureNoAvailabilityConflicts(playerIds, [{ start: startTime, end: endTime }]);

    return this.prisma.teamEvent.create({
      data: {
        teamId: data.teamId,
        coachId: userId,
        title: data.title,
        description: data.description,
        location: data.location,
        startTime,
        endTime,
      },
    });
  }

  async updateTeamEvent(
    userId: string,
    role: string,
    eventId: string,
    data: {
      title?: string;
      description?: string | null;
      location?: string | null;
      startTime?: string;
      endTime?: string;
    },
  ) {
    const event = await this.prisma.teamEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Team event not found');
    if (role !== 'ADMIN') {
      await this.assertCoachOwnsTeam(userId, event.teamId);
    }
    const startTime = data.startTime ? new Date(data.startTime) : event.startTime;
    const endTime = data.endTime ? new Date(data.endTime) : event.endTime;
    this.validateDateRange(startTime, endTime);
    const playerIds = await this.getActivePlayerIdsForTeam(event.teamId);
    await this.ensureNoAvailabilityConflicts(playerIds, [{ start: startTime, end: endTime }]);

    return this.prisma.teamEvent.update({
      where: { id: eventId },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.location !== undefined ? { location: data.location } : {}),
        ...(data.startTime !== undefined ? { startTime } : {}),
        ...(data.endTime !== undefined ? { endTime } : {}),
      },
    });
  }

  async deleteTeamEvent(userId: string, role: string, eventId: string) {
    const event = await this.prisma.teamEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Team event not found');
    if (role !== 'ADMIN') {
      await this.assertCoachOwnsTeam(userId, event.teamId);
    }
    await this.prisma.teamEvent.delete({ where: { id: eventId } });
    return { ok: true };
  }

  async listTournaments(userId: string, role: string, playerId?: string) {
    const targetPlayerId = playerId ?? userId;
    await this.assertCanAccessPlayer(userId, role, targetPlayerId);
    return this.prisma.tournament.findMany({
      where: { playerId: targetPlayerId },
      orderBy: { startTime: 'asc' },
    });
  }

  async createTournament(
    userId: string,
    role: string,
    data: {
      playerId?: string;
      title: string;
      description?: string;
      location?: string;
      startTime: string;
      endTime: string;
      priority?: TournamentPriority;
    },
  ) {
    const playerId = data.playerId ?? userId;
    await this.assertCanAccessPlayer(userId, role, playerId);
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);
    this.validateDateRange(startTime, endTime);
    await this.ensureNoAvailabilityConflicts([playerId], [{ start: startTime, end: endTime }]);

    return this.prisma.tournament.create({
      data: {
        playerId,
        title: data.title,
        description: data.description,
        location: data.location,
        startTime,
        endTime,
        priority: data.priority ?? 'PRIORITY_2',
      },
    });
  }

  async updateTournament(
    userId: string,
    role: string,
    tournamentId: string,
    data: {
      title?: string;
      description?: string | null;
      location?: string | null;
      startTime?: string;
      endTime?: string;
      priority?: TournamentPriority;
    },
  ) {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new NotFoundException('Tournament not found');
    await this.assertCanAccessPlayer(userId, role, tournament.playerId);
    const startTime = data.startTime ? new Date(data.startTime) : tournament.startTime;
    const endTime = data.endTime ? new Date(data.endTime) : tournament.endTime;
    this.validateDateRange(startTime, endTime);
    await this.ensureNoAvailabilityConflicts([tournament.playerId], [{ start: startTime, end: endTime }]);

    return this.prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.location !== undefined ? { location: data.location } : {}),
        ...(data.startTime !== undefined ? { startTime } : {}),
        ...(data.endTime !== undefined ? { endTime } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
      },
    });
  }

  async deleteTournament(userId: string, role: string, tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new NotFoundException('Tournament not found');
    await this.assertCanAccessPlayer(userId, role, tournament.playerId);
    await this.prisma.tournament.delete({ where: { id: tournamentId } });
    return { ok: true };
  }

  async listSlotTasks(userId: string, role: string, slotId: string) {
    const slot = await this.prisma.practiceSlot.findUnique({
      where: { id: slotId },
      include: { team: true },
    });
    if (!slot) throw new NotFoundException('Practice slot not found');

    if (slot.ownerType === OwnerType.TEAM) {
      const membership = slot.teamId
        ? await this.prisma.teamMember.findFirst({
            where: { teamId: slot.teamId, userId },
          })
        : null;
      if (!membership) {
        this.requireCoachOrAdmin(role);
        if (role !== 'ADMIN') {
          await this.assertCoachOwnsTeam(userId, slot.teamId ?? '');
        }
      }
    } else if (slot.playerId !== userId) {
      if (!slot.playerId) {
        throw new NotFoundException('Practice slot player not found');
      }
      await this.assertCoachPlayerLink(userId, slot.playerId);
    }

    return this.prisma.calendarTask.findMany({
      where: { practiceSlotId: slotId },
      include: {
        lesson: {
          select: {
            id: true,
            focusArea: true,
            trainingObjective: true,
            successCriteria: true,
            plannedExercises: true,
          },
        },
      },
      orderBy: { scheduledDate: 'asc' },
    });
  }

  async assignTask(
    coachId: string,
    role: string,
    slotId: string,
    data: {
      title: string;
      description: string;
      durationMinutes: number;
      scheduledDate: string;
      recurrenceCount?: number;
      recurrenceWeeks?: number;
      lessonId?: string;
    },
  ) {
    const slot = await this.prisma.practiceSlot.findUnique({
      where: { id: slotId },
      include: { team: true },
    });
    if (!slot) throw new NotFoundException('Practice slot not found');

    if (slot.ownerType === OwnerType.TEAM) {
      if (role !== 'ADMIN' && slot.teamId) {
        await this.assertCoachOwnsTeam(coachId, slot.teamId);
      }
    } else if (slot.playerId) {
      await this.assertCoachPlayerLink(coachId, slot.playerId);
    }

    const scheduledDate = new Date(data.scheduledDate);
    const scheduledEnd = new Date(scheduledDate.getTime() + data.durationMinutes * 60_000);
    this.validateDateRange(scheduledDate, scheduledEnd, 'Task duration must be positive');

    const slotStartMins = slot.startTime.getUTCHours() * 60 + slot.startTime.getUTCMinutes();
    const slotEndMins = slot.endTime.getUTCHours() * 60 + slot.endTime.getUTCMinutes();
    const taskStartMins = scheduledDate.getUTCHours() * 60 + scheduledDate.getUTCMinutes();
    const taskEndMins = taskStartMins + data.durationMinutes;

    if (taskStartMins < slotStartMins || taskEndMins > slotEndMins) {
      throw new BadRequestException('Task time must be within the practice slot window');
    }

    const affectedPlayerIds = await this.getPlayerIdsForSlot(slotId);

    if (!data.recurrenceCount || !data.recurrenceWeeks) {
      await this.ensureNoAvailabilityConflicts(affectedPlayerIds, [{ start: scheduledDate, end: scheduledEnd }]);
      return [
        await this.prisma.calendarTask.create({
          data: {
            practiceSlotId: slotId,
            coachId,
            title: data.title,
            description: data.description,
            durationMinutes: data.durationMinutes,
            scheduledDate,
            lessonId: data.lessonId ?? null,
          },
          include: {
            lesson: {
              select: {
                id: true,
                focusArea: true,
                trainingObjective: true,
                successCriteria: true,
                plannedExercises: true,
              },
            },
          },
        }),
      ];
    }

    const windowEnd = new Date(scheduledDate);
    windowEnd.setDate(windowEnd.getDate() + data.recurrenceWeeks * 7);

    const occurrences = expandRecurringOccurrences(slot, windowEnd).filter(
      (occ) => occ.start >= scheduledDate,
    );

    if (occurrences.length === 0) {
      throw new BadRequestException('No practice slot occurrences found in the specified window');
    }

    const step = Math.max(1, Math.floor(occurrences.length / data.recurrenceCount));
    const selected = occurrences
      .filter((_, index) => index % step === 0)
      .slice(0, data.recurrenceCount);

    const taskStarts = selected.map((occ) => {
      const taskDate = new Date(occ.start);
      taskDate.setUTCHours(scheduledDate.getUTCHours());
      taskDate.setUTCMinutes(scheduledDate.getUTCMinutes());
      taskDate.setUTCSeconds(0);
      taskDate.setUTCMilliseconds(0);
      return taskDate;
    });
    await this.ensureNoAvailabilityConflicts(
      affectedPlayerIds,
      this.buildTaskIntervals(taskStarts, data.durationMinutes),
    );

    return Promise.all(
      taskStarts.map((taskDate) =>
        this.prisma.calendarTask.create({
          data: {
            practiceSlotId: slotId,
            coachId,
            title: data.title,
            description: data.description,
            durationMinutes: data.durationMinutes,
            scheduledDate: taskDate,
            lessonId: data.lessonId ?? null,
          },
          include: {
            lesson: {
              select: {
                id: true,
                focusArea: true,
                trainingObjective: true,
                successCriteria: true,
                plannedExercises: true,
              },
            },
          },
        }),
      ),
    );
  }

  async updateTask(
    userId: string,
    role: string,
    taskId: string,
    data: {
      title?: string;
      description?: string;
      durationMinutes?: number;
      scheduledDate?: string;
      status?: CalendarTaskStatus;
      lessonId?: string | null;
    },
  ) {
    const task = await this.prisma.calendarTask.findUnique({
      where: { id: taskId },
      include: {
        practiceSlot: { select: { ownerType: true, playerId: true, teamId: true, startTime: true, endTime: true } },
      },
    });
    if (!task) throw new NotFoundException('Task not found');

    const playerIds = await this.getPlayerIdsForSlot(task.practiceSlotId);
    const isCoach = task.coachId === userId;
    const isAffectedPlayer = playerIds.includes(userId);
    if (!isCoach && !isAffectedPlayer) {
      throw new ForbiddenException('Not your task');
    }

    if (!isCoach) {
      const forbiddenFields = ['title', 'description', 'durationMinutes', 'scheduledDate', 'lessonId'].some(
        (field) => Object.prototype.hasOwnProperty.call(data, field),
      );
      if (forbiddenFields) {
        throw new ForbiddenException('Players can only update task completion status');
      }
    }

    const durationMinutes = data.durationMinutes ?? task.durationMinutes;
    const scheduledDate = data.scheduledDate ? new Date(data.scheduledDate) : task.scheduledDate;
    const scheduledEnd = new Date(scheduledDate.getTime() + durationMinutes * 60_000);
    this.validateDateRange(scheduledDate, scheduledEnd, 'Task duration must be positive');

    const slotStartMins = task.practiceSlot.startTime.getUTCHours() * 60 + task.practiceSlot.startTime.getUTCMinutes();
    const slotEndMins = task.practiceSlot.endTime.getUTCHours() * 60 + task.practiceSlot.endTime.getUTCMinutes();
    const taskStartMins = scheduledDate.getUTCHours() * 60 + scheduledDate.getUTCMinutes();
    const taskEndMins = taskStartMins + durationMinutes;
    if (taskStartMins < slotStartMins || taskEndMins > slotEndMins) {
      throw new BadRequestException('Task time must be within the practice slot window');
    }

    if (isCoach) {
      await this.ensureNoAvailabilityConflicts(playerIds, [{ start: scheduledDate, end: scheduledEnd }]);
    }

    return this.prisma.calendarTask.update({
      where: { id: taskId },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.durationMinutes !== undefined ? { durationMinutes } : {}),
        ...(data.scheduledDate !== undefined ? { scheduledDate } : {}),
        ...(data.lessonId !== undefined ? { lessonId: data.lessonId } : {}),
        ...(data.status !== undefined
          ? {
              status: data.status,
              completedAt: data.status === 'COMPLETED' ? new Date() : null,
            }
          : {}),
      },
      include: {
        lesson: {
          select: {
            id: true,
            focusArea: true,
            trainingObjective: true,
            successCriteria: true,
            plannedExercises: true,
          },
        },
      },
    });
  }

  async deleteTask(userId: string, role: string, taskId: string) {
    const task = await this.prisma.calendarTask.findUnique({
      where: { id: taskId },
      include: { practiceSlot: { select: { playerId: true, teamId: true, ownerType: true } } },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (task.coachId !== userId) throw new ForbiddenException('Not your task');
    if (task.practiceSlot.ownerType === OwnerType.TEAM && task.practiceSlot.teamId && role !== 'ADMIN') {
      await this.assertCoachOwnsTeam(userId, task.practiceSlot.teamId);
    }

    await this.prisma.calendarTask.delete({ where: { id: taskId } });
    return { ok: true };
  }

  async getPlayerCalendar(userId: string, role: string, playerId: string) {
    await this.assertCanAccessPlayer(userId, role, playerId);

    const activeTeamIds = await this.getActiveTeamIdsForPlayer(playerId);
    const slots = await this.prisma.practiceSlot.findMany({
      where: {
        OR: [
          { ownerType: OwnerType.PLAYER, playerId },
          ...(activeTeamIds.length > 0
            ? [{ ownerType: OwnerType.TEAM, teamId: { in: activeTeamIds } }]
            : []),
        ],
      },
      include: {
        tasks: {
          include: {
            lesson: {
              select: {
                id: true,
                focusArea: true,
                trainingObjective: true,
                successCriteria: true,
                plannedExercises: true,
              },
            },
          },
        },
        team: { select: { id: true, shortName: true, icon: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    const availabilityBlocks = await this.prisma.availabilityBlock.findMany({
      where: { playerId },
      orderBy: { startTime: 'asc' },
    });

    const teamEvents = activeTeamIds.length
      ? await this.prisma.teamEvent.findMany({
          where: { teamId: { in: activeTeamIds } },
          include: { team: { select: { shortName: true } } },
          orderBy: { startTime: 'asc' },
        })
      : [];

    const tournaments = await this.prisma.tournament.findMany({
      where: { playerId },
      orderBy: { startTime: 'asc' },
    });

    const assignments = await this.prisma.lessonAssignment.findMany({
      where: { playerId, dueDate: { not: null } },
      include: {
        lesson: {
          select: {
            id: true,
            name: true,
            focusArea: true,
            durationMinutes: true,
            trainingObjective: true,
            successCriteria: true,
            plannedExercises: true,
            subCapability: true,
            subSubCapability: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    const milestones = await this.prisma.developmentPlanMilestone.findMany({
      where: {
        plan: {
          OR: [
            { ownerType: OwnerType.PLAYER, playerId },
            ...(activeTeamIds.length > 0
              ? [{ ownerType: OwnerType.TEAM, teamId: { in: activeTeamIds } }]
              : []),
          ],
        },
      },
      include: {
        plan: { select: { id: true, name: true } },
        block: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    const limit = new Date();
    limit.setFullYear(limit.getFullYear() + 1);

    const expandedSlots = slots.map((slot: RawSlot & { tasks: any[] }) => ({
      id: slot.id,
      ownerType: slot.ownerType,
      playerId: slot.playerId,
      teamId: slot.teamId,
      team: slot.team,
      title: slot.title,
      recurrence: slot.recurrence,
      recurrenceEndDate: slot.recurrenceEndDate,
      occurrences: expandRecurringOccurrences(slot, limit),
      tasks: slot.tasks,
    }));

    const activities: Array<Record<string, unknown>> = [];

    for (const slot of expandedSlots) {
      for (const occurrence of slot.occurrences) {
        activities.push({
          id: `slot-${slot.id}-${occurrence.start.toISOString()}`,
          sourceId: slot.id,
          type: slot.ownerType === OwnerType.TEAM ? 'team-practice' : 'practice-slot',
          title: slot.title,
          start: occurrence.start.toISOString(),
          end: occurrence.end.toISOString(),
          ownerType: slot.ownerType,
          teamName: slot.team?.shortName ?? null,
        });
      }

      for (const task of slot.tasks as any[]) {
        const start = new Date(task.scheduledDate);
        const end = new Date(start.getTime() + task.durationMinutes * 60_000);
        activities.push({
          id: `task-${task.id}`,
          sourceId: task.id,
          type: 'coach-assignment',
          title: task.title,
          start: start.toISOString(),
          end: end.toISOString(),
          description: task.description,
          durationMinutes: task.durationMinutes,
          status: task.status,
          completedAt: task.completedAt,
          lesson: task.lesson,
          teamName: slot.team?.shortName ?? null,
        });
      }
    }

    for (const block of availabilityBlocks) {
      const occurrences = expandRecurringOccurrences(block, limit);
      for (const occurrence of occurrences) {
        activities.push({
          id: `availability-${block.id}-${occurrence.start.toISOString()}`,
          sourceId: block.id,
          type: 'availability-block',
          title: block.title,
          start: occurrence.start.toISOString(),
          end: occurrence.end.toISOString(),
          availabilityType: block.type,
          notes: block.notes,
        });
      }
    }

    for (const event of teamEvents) {
      activities.push({
        id: `team-event-${event.id}`,
        sourceId: event.id,
        type: 'team-event',
        title: event.title,
        start: event.startTime.toISOString(),
        end: event.endTime.toISOString(),
        description: event.description,
        location: event.location,
        teamName: event.team.shortName,
      });
    }

    for (const tournament of tournaments) {
      activities.push({
        id: `tournament-${tournament.id}`,
        sourceId: tournament.id,
        type: 'tournament',
        title: tournament.title,
        start: tournament.startTime.toISOString(),
        end: tournament.endTime.toISOString(),
        description: tournament.description,
        location: tournament.location,
        priority: tournament.priority,
      });
    }

    for (const assignment of assignments) {
      const start = new Date(assignment.dueDate as Date);
      const end = new Date(start.getTime() + assignment.lesson.durationMinutes * 60_000);
      activities.push({
        id: `assignment-${assignment.id}`,
        sourceId: assignment.id,
        type: 'lesson-mission',
        title: assignment.lesson.name,
        start: start.toISOString(),
        end: end.toISOString(),
        status: assignment.status,
        priority: assignment.priority,
        lesson: assignment.lesson,
      });
    }

    for (const milestone of milestones) {
      activities.push({
        id: `milestone-${milestone.id}`,
        sourceId: milestone.id,
        type: 'milestone',
        title: milestone.title,
        start: milestone.dueDate.toISOString(),
        end: milestone.dueDate.toISOString(),
        allDay: true,
        description: milestone.description,
        status: milestone.status,
        planName: milestone.plan.name,
        blockName: milestone.block?.name ?? null,
      });
    }

    activities.sort((a, b) => {
      const aStart = new Date(String(a.start)).getTime();
      const bStart = new Date(String(b.start)).getTime();
      return aStart - bStart;
    });

    const weekStart = startOfWeek(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekTasks = activities.filter((activity) =>
      activity.type === 'coach-assignment' &&
      new Date(String(activity.start)) >= weekStart &&
      new Date(String(activity.start)) < weekEnd,
    );
    const completedWeekTasks = weekTasks.filter((activity) => activity.status === 'COMPLETED');

    return {
      slots: expandedSlots,
      activities,
      summary: {
        weeklyCompletion: {
          completed: completedWeekTasks.length,
          total: weekTasks.length,
        },
      },
    };
  }
}
