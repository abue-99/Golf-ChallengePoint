import { BadRequestException, ForbiddenException } from '@nestjs/common';
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));
jest.mock('@challengepoint/db', () => ({
  OwnerType: { TEAM: 'TEAM', PLAYER: 'PLAYER' },
}));
const access = { isHead: true };
jest.mock('../teams/team-access', () => ({
  assertTeamAccess: jest.fn(() => Promise.resolve(access)),
}));
jest.mock('./calendar.service', () => ({ CalendarService: class {} }));

import { OccurrenceChangeService } from './occurrence-change.service';
import { buildChangeMail } from './reminder-mail';

// Weekly on Monday 16:00–17:30 UTC, far in the future.
const slot = {
  id: 'slot1',
  ownerType: 'TEAM',
  teamId: 'team1',
  title: 'Training',
  createdById: 'head',
  startTime: new Date('2030-01-07T16:00:00Z'),
  endTime: new Date('2030-01-07T17:30:00Z'),
  recurrence: 'WEEKLY',
  recurrenceEndDate: null,
  team: { shortName: 'U16' },
};
const KEY = 'slot:slot1:2030-01-14T16:00:00.000Z';

type ExceptionRow = {
  practiceSlotId: string;
  originalStart: Date;
  cancelled: boolean;
  newStart: Date | null;
  newEnd: Date | null;
  reason: string | null;
};

function setup(exceptions: ExceptionRow[] = []) {
  const prisma = {
    practiceSlot: { findUnique: jest.fn().mockResolvedValue(slot) },
    practiceSlotException: {
      findMany: jest.fn().mockResolvedValue(exceptions),
      upsert: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    attendance: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
    attendanceReminder: {
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    calendarTask: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    teamMember: {
      findMany: jest.fn().mockResolvedValue([
        {
          userId: 'p1',
          user: {
            email: 'max@test.de',
            firstName: 'Max',
            timezone: 'Europe/Berlin',
            role: 'PLAYER',
          },
        },
        {
          userId: 'c1',
          user: {
            email: 'coach@test.de',
            firstName: 'C',
            timezone: null,
            role: 'COACH',
          },
        },
      ]),
    },
    user: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ firstName: 'Anna', lastName: 'Coach' }),
    },
  };
  const calendar = {
    ensureNoAvailabilityConflicts: jest.fn().mockResolvedValue(undefined),
  };
  const mailer = { send: jest.fn().mockResolvedValue(true) };
  const service = new OccurrenceChangeService(
    prisma as never,
    calendar as never,
    mailer as never,
  );
  return { prisma, calendar, mailer, service };
}

type MailArg = { to: string; subject: string; text: string };
const firstMail = (mailer: { send: jest.Mock }) =>
  (mailer.send.mock.calls as [MailArg][])[0][0];

describe('OccurrenceChangeService', () => {
  beforeEach(() => {
    access.isHead = true;
  });

  it('cancels one occurrence, resets answers and reminders, tells the players', async () => {
    const { prisma, mailer, service } = setup();
    const result = await service.change('head', 'COACH', {
      occurrenceKey: KEY,
      action: 'cancel',
      reason: ' Course closed ',
    });
    expect(result.status).toBe('cancelled');
    expect(result.occurrenceKey).toBe(KEY);
    expect(result.answersReset).toBe(3);
    expect(prisma.practiceSlotException.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          cancelled: true,
          reason: 'Course closed',
        }) as unknown,
      }),
    );
    expect(prisma.attendanceReminder.deleteMany).toHaveBeenCalled();
    // Only players get the e-mail.
    expect(mailer.send).toHaveBeenCalledTimes(1);
    const mail = firstMail(mailer);
    expect(mail.to).toBe('max@test.de');
    expect(mail.subject).toMatch(/^Cancelled: Training/);
    expect(mail.text).toContain('Course closed');
    expect(result.notified).toBe(1);
  });

  it('moves one occurrence to a new key and asks again', async () => {
    const { prisma, calendar, mailer, service } = setup();
    const result = await service.change('head', 'COACH', {
      occurrenceKey: KEY,
      action: 'move',
      startTime: '2030-01-16T17:00:00.000Z',
      endTime: '2030-01-16T18:30:00.000Z',
    });
    expect(result.status).toBe('moved');
    expect(result.occurrenceKey).toBe('slot:slot1:2030-01-16T17:00:00.000Z');
    expect(calendar.ensureNoAvailabilityConflicts).toHaveBeenCalled();
    expect(prisma.attendance.deleteMany).toHaveBeenCalledWith({
      where: {
        occurrenceKey: {
          in: [KEY, 'slot:slot1:2030-01-16T17:00:00.000Z'],
        },
      },
    });
    expect(firstMail(mailer).subject).toMatch(/^New time: Training/);
  });

  it('moves planned lessons along', async () => {
    const { prisma, service } = setup();
    prisma.calendarTask.findMany.mockResolvedValue([
      {
        id: 't1',
        scheduledDate: new Date('2030-01-14T16:30:00Z'),
        durationMinutes: 30,
      },
    ]);
    await service.change('head', 'COACH', {
      occurrenceKey: KEY,
      action: 'move',
      startTime: '2030-01-16T17:00:00.000Z',
      endTime: '2030-01-16T18:30:00.000Z',
      notify: false,
    });
    expect(prisma.calendarTask.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { scheduledDate: new Date('2030-01-16T17:30:00Z') },
    });
  });

  it('refuses a move onto another occurrence of the series', async () => {
    const { service } = setup();
    await expect(
      service.change('head', 'COACH', {
        occurrenceKey: KEY,
        action: 'move',
        startTime: '2030-01-21T16:30:00.000Z',
        endTime: '2030-01-21T17:30:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('moving back to the series time removes the exception', async () => {
    const { prisma, service } = setup([
      {
        practiceSlotId: 'slot1',
        originalStart: new Date('2030-01-14T16:00:00Z'),
        cancelled: false,
        newStart: new Date('2030-01-16T17:00:00Z'),
        newEnd: new Date('2030-01-16T18:30:00Z'),
        reason: null,
      },
    ]);
    const result = await service.change('head', 'COACH', {
      occurrenceKey: 'slot:slot1:2030-01-16T17:00:00.000Z',
      action: 'move',
      startTime: '2030-01-14T16:00:00.000Z',
      endTime: '2030-01-14T17:30:00.000Z',
      notify: false,
    });
    expect(result.status).toBe('scheduled');
    expect(prisma.practiceSlotException.deleteMany).toHaveBeenCalled();
    expect(prisma.practiceSlotException.upsert).not.toHaveBeenCalled();
  });

  it('restores a cancelled occurrence', async () => {
    const { prisma, mailer, service } = setup([
      {
        practiceSlotId: 'slot1',
        originalStart: new Date('2030-01-14T16:00:00Z'),
        cancelled: true,
        newStart: null,
        newEnd: null,
        reason: 'x',
      },
    ]);
    const result = await service.change('head', 'COACH', {
      occurrenceKey: KEY,
      action: 'restore',
    });
    expect(result.status).toBe('scheduled');
    expect(prisma.practiceSlotException.deleteMany).toHaveBeenCalled();
    expect(firstMail(mailer).subject).toMatch(/^Back on: Training/);
  });

  it('lets staff change only trainings they planned', async () => {
    access.isHead = false;
    const { service } = setup();
    await expect(
      service.change('assist', 'COACH', {
        occurrenceKey: KEY,
        action: 'cancel',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects players, bad actions and past occurrences', async () => {
    const { service } = setup();
    await expect(
      service.change('p1', 'PLAYER', { occurrenceKey: KEY, action: 'cancel' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.change('head', 'COACH', { occurrenceKey: KEY, action: 'nope' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.change('head', 'COACH', {
        occurrenceKey: 'slot:slot1:2030-01-07T16:00:00.000Z',
        action: 'cancel',
      }),
    ).resolves.toBeDefined();
    const { service: pastService, prisma } = setup();
    prisma.practiceSlot.findUnique.mockResolvedValue({
      ...slot,
      startTime: new Date('2020-01-06T16:00:00Z'),
      endTime: new Date('2020-01-06T17:30:00Z'),
    });
    await expect(
      pastService.change('head', 'COACH', {
        occurrenceKey: 'slot:slot1:2020-01-13T16:00:00.000Z',
        action: 'cancel',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('buildChangeMail', () => {
  it('escapes HTML and names old and new time', () => {
    const mail = buildChangeMail({
      kind: 'moved',
      firstName: 'Max',
      coachName: 'Anna',
      title: '<b>Training</b>',
      teamName: 'U16',
      when: 'Wed 16 Jan, 18:00–19:30',
      was: 'Mon 14 Jan, 17:00–18:30',
      reason: null,
      url: 'https://example.com/dashboard',
    });
    expect(mail.html).not.toContain('<b>Training</b>');
    expect(mail.text).toContain('Before: Mon 14 Jan, 17:00–18:30');
    expect(mail.text).toContain('New time: Wed 16 Jan, 18:00–19:30');
  });
});
