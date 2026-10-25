import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OwnerType } from '@challengepoint/db';
import { PrismaService } from '../prisma/prisma.service';
import { assertTeamAccess } from '../teams/team-access';
import { slotOccurrenceKey } from './attendance.service';
import { parseOccurrenceKey } from './attendance-reminder.service';
import { CalendarService } from './calendar.service';
import {
  expandEffective,
  findEffectiveOccurrence,
  loadSlotExceptions,
  type EffectiveOccurrence,
} from './occurrences';
import {
  appUrl,
  buildChangeMail,
  formatSession,
  ReminderMailer,
} from './reminder-mail';

const MAX_REASON_LENGTH = 300;
const DAY_MS = 24 * 60 * 60 * 1000;
/** A moved occurrence stays within this distance of its series time. */
const MAX_SHIFT_DAYS = 60;

export type OccurrenceAction = 'cancel' | 'move' | 'restore';

type Body = {
  occurrenceKey?: unknown;
  action?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  reason?: unknown;
  notify?: unknown;
  force?: unknown;
};

function parseDate(value: unknown, field: string) {
  if (typeof value !== 'string') {
    throw new BadRequestException(`${field} is required`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${field} is not a valid date`);
  }
  return date;
}

function cleanReason(value: unknown) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new BadRequestException('reason must be text');
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_REASON_LENGTH) {
    throw new BadRequestException(
      `The note is longer than ${MAX_REASON_LENGTH} characters`,
    );
  }
  return trimmed || null;
}

/**
 * Moving, cancelling and restoring a single occurrence of a team training.
 * The series stays as it is; the players' answers and reminders of the
 * occurrence are reset and the players are told by e-mail.
 */
@Injectable()
export class OccurrenceChangeService {
  private readonly logger = new Logger(OccurrenceChangeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calendar: CalendarService,
    private readonly mailer: ReminderMailer,
  ) {}

  async change(userId: string, role: string, body: Body) {
    if (role !== 'COACH' && role !== 'ADMIN') {
      throw new ForbiddenException('Only coaches change team trainings');
    }
    const action = body.action;
    if (action !== 'cancel' && action !== 'move' && action !== 'restore') {
      throw new BadRequestException('action must be cancel, move or restore');
    }
    const parsed = parseOccurrenceKey(body.occurrenceKey);
    if (!parsed || parsed.kind !== 'slot') {
      throw new BadRequestException('Invalid occurrenceKey');
    }
    const slot = await this.prisma.practiceSlot.findUnique({
      where: { id: parsed.slotId },
      include: { team: { select: { shortName: true } } },
    });
    if (!slot || slot.ownerType !== OwnerType.TEAM || !slot.teamId) {
      throw new NotFoundException('Team training not found');
    }
    // Head coach changes everything of the team, staff what they planned.
    const access = await assertTeamAccess(
      this.prisma,
      userId,
      role,
      slot.teamId,
    );
    if (!access.isHead && slot.createdById !== userId) {
      throw new ForbiddenException(
        'Only the head coach or the coach who planned it can change this',
      );
    }

    const exceptions =
      (await loadSlotExceptions(this.prisma, [slot.id])).get(slot.id) ?? [];
    const current = findEffectiveOccurrence(slot, exceptions, parsed.start);
    if (!current) {
      throw new NotFoundException('This training does not take place then');
    }
    const now = Date.now();
    if (action !== 'restore' && current.end.getTime() < now) {
      throw new BadRequestException('This training is already over');
    }

    const reason = cleanReason(body.reason);
    const notify = body.notify !== false;
    const oldKey = slotOccurrenceKey(slot.id, current.start);
    const exceptionWhere = {
      practiceSlotId_originalStart: {
        practiceSlotId: slot.id,
        originalStart: current.originalStart,
      },
    };

    let next: EffectiveOccurrence;
    if (action === 'cancel') {
      if (current.status === 'cancelled') {
        throw new BadRequestException('This training is already cancelled');
      }
      // Planned lessons go back to the series time, so restoring brings
      // them back where they belong.
      await this.shiftTasks(slot.id, current, current.originalStart);
      await this.prisma.practiceSlotException.upsert({
        where: exceptionWhere,
        create: {
          practiceSlotId: slot.id,
          originalStart: current.originalStart,
          cancelled: true,
          reason,
          changedById: userId,
        },
        update: {
          cancelled: true,
          newStart: null,
          newEnd: null,
          reason,
          changedById: userId,
        },
      });
      next = {
        ...current,
        start: current.originalStart,
        end: current.originalEnd,
        status: 'cancelled',
        reason,
      };
    } else if (action === 'restore') {
      if (current.status === 'scheduled') {
        throw new BadRequestException('This training takes place as planned');
      }
      if (current.originalEnd.getTime() < now) {
        throw new BadRequestException(
          'The usual time is already over – move the training instead',
        );
      }
      await this.shiftTasks(slot.id, current, current.originalStart);
      await this.prisma.practiceSlotException.deleteMany({
        where: {
          practiceSlotId: slot.id,
          originalStart: current.originalStart,
        },
      });
      next = {
        ...current,
        start: current.originalStart,
        end: current.originalEnd,
        status: 'scheduled',
        reason: null,
      };
    } else {
      next = await this.prepareMove(
        slot,
        exceptions,
        current,
        parseDate(body.startTime, 'startTime'),
        parseDate(body.endTime, 'endTime'),
        reason,
        body.force === true,
      );
      if (next.status === 'scheduled') {
        // Back to the series time: no exception needed.
        await this.prisma.practiceSlotException.deleteMany({
          where: {
            practiceSlotId: slot.id,
            originalStart: current.originalStart,
          },
        });
      } else {
        await this.prisma.practiceSlotException.upsert({
          where: exceptionWhere,
          create: {
            practiceSlotId: slot.id,
            originalStart: current.originalStart,
            cancelled: false,
            newStart: next.start,
            newEnd: next.end,
            reason,
            changedById: userId,
          },
          update: {
            cancelled: false,
            newStart: next.start,
            newEnd: next.end,
            reason,
            changedById: userId,
          },
        });
      }
    }

    // New time (or no training) = new question: answers and reminders of
    // the occurrence no longer apply.
    const newKey = slotOccurrenceKey(slot.id, next.start);
    const keys = [...new Set([oldKey, newKey])];
    const reset = await this.prisma.attendance.deleteMany({
      where: { occurrenceKey: { in: keys } },
    });
    await this.prisma.attendanceReminder.deleteMany({
      where: { occurrenceKey: { in: keys } },
    });

    const timeChanged =
      next.start.getTime() !== current.start.getTime() ||
      next.end.getTime() !== current.end.getTime() ||
      next.status !== current.status;
    const mail =
      notify && timeChanged
        ? await this.notifyPlayers({
            teamId: slot.teamId,
            teamName: slot.team?.shortName ?? 'your team',
            title: slot.title,
            kind:
              next.status === 'cancelled'
                ? 'cancelled'
                : next.status === 'moved'
                  ? 'moved'
                  : 'restored',
            before: current,
            after: next,
            reason: next.status === 'scheduled' ? null : reason,
            coachId: userId,
          })
        : { recipients: 0, sent: 0 };

    return {
      occurrenceKey: newKey,
      previousKey: oldKey,
      status: next.status,
      start: next.start.toISOString(),
      end: next.end.toISOString(),
      originalStart: next.originalStart.toISOString(),
      originalEnd: next.originalEnd.toISOString(),
      reason: next.status === 'scheduled' ? null : next.reason,
      answersReset: reset.count,
      notified: mail.sent,
      recipients: mail.recipients,
    };
  }

  private async prepareMove(
    slot: {
      id: string;
      teamId: string | null;
      startTime: Date;
      endTime: Date;
      recurrence: string;
      recurrenceEndDate: Date | null;
    },
    exceptions: Parameters<typeof expandEffective>[1],
    current: EffectiveOccurrence,
    start: Date,
    end: Date,
    reason: string | null,
    force: boolean,
  ): Promise<EffectiveOccurrence> {
    if (start >= end) {
      throw new BadRequestException('Start time must be before end time');
    }
    if (end.getTime() - start.getTime() > DAY_MS) {
      throw new BadRequestException('A training can last at most one day');
    }
    if (end.getTime() < Date.now()) {
      throw new BadRequestException('The new time is already over');
    }
    if (
      Math.abs(start.getTime() - current.originalStart.getTime()) >
      MAX_SHIFT_DAYS * DAY_MS
    ) {
      throw new BadRequestException(
        `A single training can be moved by at most ${MAX_SHIFT_DAYS} days – change the series instead`,
      );
    }
    const backToSeries =
      start.getTime() === current.originalStart.getTime() &&
      end.getTime() === current.originalEnd.getTime();

    // Two occurrences of the same training must not start at the same time.
    const others = expandEffective(
      slot,
      exceptions,
      new Date(start.getTime() - DAY_MS),
      new Date(end.getTime() + DAY_MS),
    ).filter(
      (occurrence) =>
        occurrence.originalStart.getTime() !==
          current.originalStart.getTime() && occurrence.status !== 'cancelled',
    );
    const clash = others.find(
      (occurrence) => occurrence.start < end && start < occurrence.end,
    );
    if (clash) {
      throw new BadRequestException(
        'This training already takes place at that time – pick another time',
      );
    }

    const timeChanged =
      start.getTime() !== current.start.getTime() ||
      end.getTime() !== current.end.getTime() ||
      current.status === 'cancelled';
    if (timeChanged && !force && slot.teamId) {
      const members = await this.prisma.teamMember.findMany({
        where: { teamId: slot.teamId },
        select: { userId: true },
      });
      await this.calendar.ensureNoAvailabilityConflicts(
        members.map((member) => member.userId),
        [{ start, end }],
        undefined,
        true,
      );
    }

    // Planned lessons move along and must still fit into the new time.
    const base = current.status === 'cancelled' ? current.originalStart : null;
    const from = base ?? current.start;
    const delta = start.getTime() - from.getTime();
    const tasks = await this.tasksIn(
      slot.id,
      from,
      base ? current.originalEnd : current.end,
    );
    const outside = tasks.some((task) => {
      const taskStart = task.scheduledDate.getTime() + delta;
      const taskEnd = taskStart + task.durationMinutes * 60_000;
      return taskStart < start.getTime() || taskEnd > end.getTime();
    });
    if (outside) {
      throw new BadRequestException(
        'A planned lesson would no longer fit into the training – shorten or remove it first',
      );
    }
    if (delta !== 0) {
      for (const task of tasks) {
        await this.prisma.calendarTask.update({
          where: { id: task.id },
          data: {
            scheduledDate: new Date(task.scheduledDate.getTime() + delta),
          },
        });
      }
    }

    return {
      ...current,
      start,
      end,
      status: backToSeries ? 'scheduled' : 'moved',
      reason: backToSeries ? null : reason,
    };
  }

  /** Lessons planned inside [start, end] of a training. */
  private tasksIn(slotId: string, start: Date, end: Date) {
    return this.prisma.calendarTask.findMany({
      where: {
        practiceSlotId: slotId,
        scheduledDate: { gte: start, lt: end },
      },
      select: { id: true, scheduledDate: true, durationMinutes: true },
    });
  }

  /** Moves the lessons of a moved occurrence to `target` (series time). */
  private async shiftTasks(
    slotId: string,
    current: EffectiveOccurrence,
    target: Date,
  ) {
    if (current.status !== 'moved') return;
    const delta = target.getTime() - current.start.getTime();
    if (delta === 0) return;
    const tasks = await this.tasksIn(slotId, current.start, current.end);
    for (const task of tasks) {
      await this.prisma.calendarTask.update({
        where: { id: task.id },
        data: {
          scheduledDate: new Date(task.scheduledDate.getTime() + delta),
        },
      });
    }
  }

  private async notifyPlayers(input: {
    teamId: string;
    teamName: string;
    title: string;
    kind: 'moved' | 'cancelled' | 'restored';
    before: EffectiveOccurrence;
    after: EffectiveOccurrence;
    reason: string | null;
    coachId: string;
  }) {
    try {
      const [members, coach] = await Promise.all([
        this.prisma.teamMember.findMany({
          where: { teamId: input.teamId },
          select: {
            user: {
              select: {
                email: true,
                firstName: true,
                timezone: true,
                role: true,
              },
            },
          },
        }),
        this.prisma.user.findUnique({
          where: { id: input.coachId },
          select: { firstName: true, lastName: true },
        }),
      ]);
      const coachName = coach
        ? [coach.firstName, coach.lastName].filter(Boolean).join(' ') || null
        : null;
      const players = members
        .map((member) => member.user)
        .filter((user) => user.role === 'PLAYER' && Boolean(user.email));
      // Cancelled: the calendar; otherwise the home page asks again.
      const url = `${appUrl()}${input.kind === 'cancelled' ? '/calendar' : '/dashboard'}`;
      const results = await Promise.all(
        players.map((user) => {
          const zone = user.timezone || process.env.TZ || 'Europe/Berlin';
          const mail = buildChangeMail({
            kind: input.kind,
            firstName: user.firstName,
            coachName,
            title: input.title,
            teamName: input.teamName,
            when: formatSession(input.after.start, input.after.end, zone),
            was:
              input.before.status === 'cancelled'
                ? null
                : formatSession(input.before.start, input.before.end, zone),
            reason: input.reason,
            url,
          });
          return this.mailer.send({ to: user.email, ...mail });
        }),
      );
      return {
        recipients: players.length,
        sent: results.filter(Boolean).length,
      };
    } catch (err) {
      // The change is saved; a failing mail provider must not undo it.
      this.logger.error(`Change e-mails failed: ${String(err)}`);
      return { recipients: 0, sent: 0 };
    }
  }
}
