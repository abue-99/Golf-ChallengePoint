import { BadRequestException, ForbiddenException } from '@nestjs/common';
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));
jest.mock('@challengepoint/db', () => ({
  OwnerType: { TEAM: 'TEAM', PLAYER: 'PLAYER' },
}));

import {
  AttendanceReminderService,
  isAutoReminderDue,
  parseOccurrenceKey,
} from './attendance-reminder.service';
import { buildReminderMail, formatSession } from './reminder-mail';

const HOUR = 60 * 60 * 1000;

describe('parseOccurrenceKey', () => {
  it('reads slot and event keys', () => {
    expect(parseOccurrenceKey('event:e1')).toEqual({
      kind: 'event',
      eventId: 'e1',
    });
    const slot = parseOccurrenceKey('slot:s1:2030-01-07T16:00:00.000Z');
    expect(slot).toEqual({
      kind: 'slot',
      slotId: 's1',
      start: new Date('2030-01-07T16:00:00.000Z'),
    });
  });

  it('rejects anything else', () => {
    expect(parseOccurrenceKey('slot:s1:not-a-date')).toBeNull();
    expect(parseOccurrenceKey('event:')).toBeNull();
    expect(parseOccurrenceKey(42)).toBeNull();
    expect(parseOccurrenceKey('team:1')).toBeNull();
  });
});

describe('isAutoReminderDue', () => {
  const now = new Date('2030-01-06T10:00:00Z');
  const base = {
    now,
    hours: 24,
    autoAlreadySent: false,
    lastManualAt: null,
  };

  it('is due inside the window', () => {
    expect(
      isAutoReminderDue({ ...base, start: new Date(now.getTime() + 5 * HOUR) }),
    ).toBe(true);
  });

  it('waits until the window opens and stops once started', () => {
    expect(
      isAutoReminderDue({
        ...base,
        start: new Date(now.getTime() + 30 * HOUR),
      }),
    ).toBe(false);
    expect(
      isAutoReminderDue({ ...base, start: new Date(now.getTime() - HOUR) }),
    ).toBe(false);
  });

  it('sends only once and not right after a manual reminder', () => {
    const start = new Date(now.getTime() + 5 * HOUR);
    expect(isAutoReminderDue({ ...base, start, autoAlreadySent: true })).toBe(
      false,
    );
    expect(
      isAutoReminderDue({
        ...base,
        start,
        lastManualAt: new Date(now.getTime() - 2 * HOUR),
      }),
    ).toBe(false);
    expect(
      isAutoReminderDue({
        ...base,
        start,
        lastManualAt: new Date(now.getTime() - 7 * HOUR),
      }),
    ).toBe(true);
  });
});

describe('buildReminderMail', () => {
  it('escapes user-provided text in HTML', () => {
    const mail = buildReminderMail({
      firstName: '<b>Max</b>',
      coachName: 'Carla',
      title: 'Training & <script>',
      teamName: 'U16',
      when: 'Tue 7 Jan, 17:00–18:30',
      location: null,
      url: 'https://example.com/home',
    });
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('Training &amp; &lt;script&gt;');
    expect(mail.text).toContain('Carla would like to know');
    expect(mail.subject).toContain('Are you coming?');
  });

  it('formats the time in the player time zone', () => {
    expect(
      formatSession(
        new Date('2030-01-07T16:00:00Z'),
        new Date('2030-01-07T17:30:00Z'),
        'Europe/Berlin',
      ),
    ).toBe('Mon 7 Jan, 17:00–18:30');
  });
});

describe('AttendanceReminderService.remind', () => {
  const future = new Date(Date.now() + 2 * 24 * HOUR);
  future.setUTCMinutes(0, 0, 0);
  const event = {
    id: 'e1',
    teamId: 't1',
    title: 'Match',
    startTime: future,
    endTime: new Date(future.getTime() + 3 * HOUR),
    location: 'GC Nord',
  };

  function setup(overrides: Record<string, unknown> = {}) {
    const prisma = {
      teamEvent: { findUnique: jest.fn().mockResolvedValue(event) },
      team: {
        findUnique: jest.fn().mockImplementation(({ select }) =>
          select.members
            ? Promise.resolve({
                shortName: 'U16',
                members: [
                  {
                    user: {
                      id: 'p1',
                      email: 'p1@x.de',
                      firstName: 'A',
                      timezone: null,
                    },
                  },
                  {
                    user: {
                      id: 'p2',
                      email: 'p2@x.de',
                      firstName: 'B',
                      timezone: null,
                    },
                  },
                  {
                    user: {
                      id: 'p3',
                      email: 'p3@x.de',
                      firstName: 'C',
                      timezone: null,
                    },
                  },
                ],
              })
            : Promise.resolve({
                id: 't1',
                coachId: 'coach1',
                shortName: 'U16',
              }),
        ),
      },
      attendance: {
        findMany: jest.fn().mockResolvedValue([{ playerId: 'p2' }]),
      },
      attendanceReminder: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockResolvedValue({ sentAt: new Date(), kind: 'MANUAL' }),
      },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ firstName: 'Carla', lastName: 'Coach' }),
      },
      ...overrides,
    };
    const mailer = { send: jest.fn().mockResolvedValue(true) };
    const service = new AttendanceReminderService(
      prisma as never,
      mailer as never,
    );
    return { prisma, mailer, service };
  }

  it('e-mails only players without an answer and records it', async () => {
    const { service, mailer, prisma } = setup();
    const result = await service.remind('coach1', 'COACH', 'event:e1');
    expect(result.sent).toBe(2);
    expect(mailer.send.mock.calls.map((call) => call[0].to)).toEqual([
      'p1@x.de',
      'p3@x.de',
    ]);
    expect(prisma.attendanceReminder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          occurrenceKey: 'event:e1',
          kind: 'MANUAL',
          sentById: 'coach1',
          recipientCount: 2,
        }),
      }),
    );
  });

  it('refuses other coaches and players', async () => {
    const { service } = setup();
    await expect(
      service.remind('someone', 'COACH', 'event:e1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.remind('p1', 'PLAYER', 'event:e1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('has a cooldown after a reminder', async () => {
    const { service } = setup({
      attendanceReminder: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ sentAt: new Date(Date.now() - 10 * 60_000) }),
        create: jest.fn(),
      },
    });
    await expect(
      service.remind('coach1', 'COACH', 'event:e1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
