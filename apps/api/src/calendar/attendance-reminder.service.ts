import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { OwnerType } from '@challengepoint/db';
import { PrismaService } from '../prisma/prisma.service';
import { expandOccurrences } from '../roster/roster.helpers';
import { assertTeamAccess } from '../teams/team-access';
import { eventOccurrenceKey, slotOccurrenceKey } from './attendance.service';
import {
  appUrl,
  buildReminderMail,
  formatSession,
  ReminderMailer,
} from './reminder-mail';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
/** A coach can remind the same session again after this pause. */
export const MANUAL_COOLDOWN_MS = 60 * MINUTE_MS;
/** No automatic reminder shortly after a manual one. */
const AUTO_AFTER_MANUAL_MS = 6 * HOUR_MS;
const AUTO_INTERVAL_MS = 10 * MINUTE_MS;
export const AUTO_REMIND_MAX_HOURS = 7 * 24;

export type ParsedOccurrenceKey =
  | { kind: 'slot'; slotId: string; start: Date }
  | { kind: 'event'; eventId: string };

/** "slot:<slotId>:<ISO start>" or "event:<eventId>". */
export function parseOccurrenceKey(key: unknown): ParsedOccurrenceKey | null {
  if (typeof key !== 'string') return null;
  if (key.startsWith('event:')) {
    const eventId = key.slice(6);
    return eventId ? { kind: 'event', eventId } : null;
  }
  const match = /^slot:([^:]+):(.+)$/.exec(key);
  if (!match) return null;
  const start = new Date(match[2]);
  if (Number.isNaN(start.getTime())) return null;
  return { kind: 'slot', slotId: match[1], start };
}

/** Whether an automatic reminder is due for one occurrence. */
export function isAutoReminderDue(input: {
  start: Date;
  now: Date;
  hours: number;
  autoAlreadySent: boolean;
  lastManualAt: Date | null;
}) {
  if (input.autoAlreadySent) return false;
  if (input.start <= input.now) return false;
  if (input.start.getTime() - input.now.getTime() > input.hours * HOUR_MS) {
    return false;
  }
  if (
    input.lastManualAt &&
    input.now.getTime() - input.lastManualAt.getTime() < AUTO_AFTER_MANUAL_MS
  ) {
    return false;
  }
  return true;
}

type ResolvedOccurrence = {
  key: string;
  teamId: string;
  title: string;
  start: Date;
  end: Date;
  location: string | null;
};

/** Reminds players who have not answered for a team training or event. */
@Injectable()
export class AttendanceReminderService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AttendanceReminderService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: ReminderMailer,
  ) {}

  onModuleInit() {
    if (
      process.env.ATTENDANCE_AUTO_REMIND === 'off' ||
      process.env.NODE_ENV === 'test'
    ) {
      return;
    }
    const interval =
      Number(process.env.ATTENDANCE_REMIND_INTERVAL_MS) || AUTO_INTERVAL_MS;
    this.timer = setInterval(() => void this.runAutoReminders(), interval);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Last reminder per occurrence key (for the coach calendar). */
  async lastReminders(keys: string[]) {
    const result = new Map<string, { sentAt: Date; kind: string }>();
    if (keys.length === 0) return result;
    const rows = await this.prisma.attendanceReminder.findMany({
      where: { occurrenceKey: { in: keys } },
      orderBy: { sentAt: 'desc' },
      select: { occurrenceKey: true, sentAt: true, kind: true },
    });
    for (const row of rows) {
      if (!result.has(row.occurrenceKey)) {
        result.set(row.occurrenceKey, { sentAt: row.sentAt, kind: row.kind });
      }
    }
    return result;
  }

  async remind(coachId: string, role: string, occurrenceKey: unknown) {
    if (role !== 'COACH' && role !== 'ADMIN') {
      throw new ForbiddenException('Only coaches send reminders');
    }
    const occurrence = await this.resolve(occurrenceKey);
    await assertTeamAccess(this.prisma, coachId, role, occurrence.teamId);
    if (occurrence.end.getTime() < Date.now()) {
      throw new BadRequestException('This session is already over');
    }
    const last = await this.prisma.attendanceReminder.findFirst({
      where: { occurrenceKey: occurrence.key },
      orderBy: { sentAt: 'desc' },
      select: { sentAt: true },
    });
    if (last && Date.now() - last.sentAt.getTime() < MANUAL_COOLDOWN_MS) {
      const minutes = Math.ceil(
        (MANUAL_COOLDOWN_MS - (Date.now() - last.sentAt.getTime())) / MINUTE_MS,
      );
      throw new BadRequestException(
        `Players were just reminded. You can remind them again in ${minutes} min.`,
      );
    }
    const coach = await this.prisma.user.findUnique({
      where: { id: coachId },
      select: { firstName: true, lastName: true },
    });
    const coachName = coach
      ? [coach.firstName, coach.lastName].filter(Boolean).join(' ') || null
      : null;
    return this.send(occurrence, {
      kind: 'MANUAL',
      sentById: coachId,
      coachName,
    });
  }

  async setAutoRemind(
    coachId: string,
    role: string,
    teamId: string,
    hours: unknown,
  ) {
    const team = await assertTeamAccess(this.prisma, coachId, role, teamId);
    if (role !== 'ADMIN' && team.coachId !== coachId) {
      throw new ForbiddenException('Only the head coach changes this');
    }
    let value: number | null = null;
    if (hours !== null && hours !== undefined && hours !== '') {
      const parsed = Number(hours);
      if (
        !Number.isInteger(parsed) ||
        parsed < 1 ||
        parsed > AUTO_REMIND_MAX_HOURS
      ) {
        throw new BadRequestException(
          `hours must be between 1 and ${AUTO_REMIND_MAX_HOURS}, or null`,
        );
      }
      value = parsed;
    }
    return this.prisma.team.update({
      where: { id: teamId },
      data: { autoRemindHours: value },
      select: { id: true, autoRemindHours: true },
    });
  }

  /** One pass over all teams with automatic reminders. */
  async runAutoReminders(now = new Date()) {
    if (this.running) return { sent: 0 };
    this.running = true;
    let sent = 0;
    try {
      const teams = await this.prisma.team.findMany({
        where: { autoRemindHours: { not: null } },
        select: {
          id: true,
          autoRemindHours: true,
          coach: { select: { firstName: true, lastName: true } },
        },
      });
      for (const team of teams) {
        const hours = team.autoRemindHours as number;
        const horizon = new Date(now.getTime() + hours * HOUR_MS);
        const occurrences = await this.teamOccurrences(team.id, now, horizon);
        if (occurrences.length === 0) continue;
        const reminders = await this.prisma.attendanceReminder.findMany({
          where: { occurrenceKey: { in: occurrences.map((o) => o.key) } },
          select: { occurrenceKey: true, kind: true, sentAt: true },
        });
        const coachName =
          [team.coach.firstName, team.coach.lastName]
            .filter(Boolean)
            .join(' ') || null;
        for (const occurrence of occurrences) {
          const forKey = reminders.filter(
            (r) => r.occurrenceKey === occurrence.key,
          );
          const lastManual = forKey
            .filter((r) => r.kind === 'MANUAL')
            .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())[0];
          const due = isAutoReminderDue({
            start: occurrence.start,
            now,
            hours,
            autoAlreadySent: forKey.some((r) => r.kind === 'AUTO'),
            lastManualAt: lastManual?.sentAt ?? null,
          });
          if (!due) continue;
          const result = await this.send(occurrence, {
            kind: 'AUTO',
            sentById: null,
            coachName,
          });
          sent += result.sent;
        }
      }
    } catch (err) {
      this.logger.error(`Automatic reminders failed: ${String(err)}`);
    } finally {
      this.running = false;
    }
    return { sent };
  }

  private async teamOccurrences(teamId: string, from: Date, to: Date) {
    const [slots, events] = await Promise.all([
      this.prisma.practiceSlot.findMany({
        where: { ownerType: OwnerType.TEAM, teamId, startTime: { lte: to } },
      }),
      this.prisma.teamEvent.findMany({
        where: { teamId, startTime: { gt: from, lte: to } },
      }),
    ]);
    const result: ResolvedOccurrence[] = [];
    for (const slot of slots) {
      for (const occurrence of expandOccurrences(slot, from, to)) {
        if (occurrence.start <= from || occurrence.start > to) continue;
        result.push({
          key: slotOccurrenceKey(slot.id, occurrence.start),
          teamId,
          title: slot.title,
          start: occurrence.start,
          end: occurrence.end,
          location: null,
        });
      }
    }
    for (const event of events) {
      result.push({
        key: eventOccurrenceKey(event.id),
        teamId,
        title: event.title,
        start: event.startTime,
        end: event.endTime,
        location: event.location,
      });
    }
    return result;
  }

  private async resolve(key: unknown): Promise<ResolvedOccurrence> {
    const parsed = parseOccurrenceKey(key);
    if (!parsed) throw new BadRequestException('Invalid occurrenceKey');
    if (parsed.kind === 'event') {
      const event = await this.prisma.teamEvent.findUnique({
        where: { id: parsed.eventId },
      });
      if (!event) throw new NotFoundException('Team event not found');
      return {
        key: eventOccurrenceKey(event.id),
        teamId: event.teamId,
        title: event.title,
        start: event.startTime,
        end: event.endTime,
        location: event.location,
      };
    }
    const slot = await this.prisma.practiceSlot.findUnique({
      where: { id: parsed.slotId },
    });
    if (!slot || slot.ownerType !== OwnerType.TEAM || !slot.teamId) {
      throw new NotFoundException('Team training not found');
    }
    const match = expandOccurrences(
      slot,
      new Date(parsed.start.getTime() - MINUTE_MS),
      new Date(parsed.start.getTime() + MINUTE_MS),
    ).find((o) => o.start.getTime() === parsed.start.getTime());
    if (!match) {
      throw new NotFoundException('This training does not take place then');
    }
    return {
      key: slotOccurrenceKey(slot.id, match.start),
      teamId: slot.teamId,
      title: slot.title,
      start: match.start,
      end: match.end,
      location: null,
    };
  }

  private async send(
    occurrence: ResolvedOccurrence,
    options: {
      kind: 'MANUAL' | 'AUTO';
      sentById: string | null;
      coachName: string | null;
    },
  ) {
    const [team, answers] = await Promise.all([
      this.prisma.team.findUnique({
        where: { id: occurrence.teamId },
        select: {
          shortName: true,
          members: {
            select: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  timezone: true,
                  role: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.attendance.findMany({
        where: { occurrenceKey: occurrence.key },
        select: { playerId: true },
      }),
    ]);
    if (!team) throw new NotFoundException('Team not found');
    const answered = new Set(answers.map((answer) => answer.playerId));
    // Only players answer; coaches listed as members are not asked.
    const open = team.members
      .map((member) => member.user)
      .filter((user) => user.role === 'PLAYER' && !answered.has(user.id));

    // Player home shows "Are you coming?" with the answer buttons.
    const url = `${appUrl()}/dashboard`;
    const results = await Promise.all(
      open
        .filter((user) => Boolean(user.email))
        .map((user) => {
          const mail = buildReminderMail({
            firstName: user.firstName,
            coachName: options.coachName,
            title: occurrence.title,
            teamName: team.shortName,
            when: formatSession(
              occurrence.start,
              occurrence.end,
              user.timezone || process.env.TZ || 'Europe/Berlin',
            ),
            location: occurrence.location,
            url,
          });
          return this.mailer.send({ to: user.email, ...mail });
        }),
    );
    const sent = results.filter(Boolean).length;

    // Nothing delivered although players were open (e.g. the mail provider
    // is down): do not record it, so the cooldown does not block a retry and
    // the automatic reminder runs again on the next pass.
    if (sent === 0 && open.length > 0) {
      this.logger.warn(
        `Reminder for ${occurrence.key}: no e-mail could be delivered`,
      );
      return {
        occurrenceKey: occurrence.key,
        open: open.length,
        sent,
        failed: open.length,
        lastReminder: null,
      };
    }
    const record = await this.prisma.attendanceReminder.create({
      data: {
        occurrenceKey: occurrence.key,
        teamId: occurrence.teamId,
        sentById: options.sentById,
        kind: options.kind,
        recipientCount: sent,
      },
      select: { sentAt: true, kind: true },
    });
    if (options.kind === 'AUTO') {
      this.logger.log(
        `Automatic reminder for ${occurrence.key}: ${sent}/${open.length} sent`,
      );
    }
    return {
      occurrenceKey: occurrence.key,
      open: open.length,
      sent,
      failed: open.length - sent,
      lastReminder: record,
    };
  }
}
