import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
// The service only needs the Prisma methods mocked below.
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

import {
  AttendanceService,
  loadAttendanceSummaries,
  slotOccurrenceKey,
} from './attendance.service';

const weekly = {
  id: 'slot1',
  ownerType: 'TEAM',
  teamId: 'team1',
  startTime: new Date('2030-01-07T16:00:00Z'),
  endTime: new Date('2030-01-07T17:30:00Z'),
  recurrence: 'WEEKLY',
  recurrenceEndDate: null,
};

type UpsertCreate = {
  occurrenceKey: string;
  status: string;
  note: string | null;
};

function upsertCreate(prisma: ReturnType<typeof makePrisma>) {
  const calls = prisma.attendance.upsert.mock.calls as [
    { create: UpsertCreate },
  ][];
  return calls[0][0].create;
}

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    practiceSlot: { findUnique: jest.fn().mockResolvedValue(weekly) },
    practiceSlotException: { findMany: jest.fn().mockResolvedValue([]) },
    teamEvent: { findUnique: jest.fn() },
    teamMember: {
      findFirst: jest.fn().mockResolvedValue({ id: 'm1' }),
      findMany: jest.fn(),
    },
    attendance: {
      upsert: jest
        .fn()
        .mockImplementation(({ create }: { create: UpsertCreate }) => ({
          occurrenceKey: create.occurrenceKey,
          status: create.status,
          note: create.note,
        })),
      findMany: jest.fn(),
    },
    ...overrides,
  };
}

describe('AttendanceService.respond', () => {
  it('stores an answer for a real occurrence of a weekly training', async () => {
    const prisma = makePrisma();
    const service = new AttendanceService(prisma as never);
    const start = '2030-01-14T16:00:00.000Z';
    const result = await service.respond('p1', 'PLAYER', {
      practiceSlotId: 'slot1',
      occurrenceStart: start,
      status: 'NOT_GOING',
      note: '  Schule  ',
    });
    expect(result.occurrenceKey).toBe(
      slotOccurrenceKey('slot1', new Date(start)),
    );
    expect(upsertCreate(prisma).note).toBe('Schule');
  });

  it('drops the reason when the player is going', async () => {
    const prisma = makePrisma();
    const service = new AttendanceService(prisma as never);
    await service.respond('p1', 'PLAYER', {
      practiceSlotId: 'slot1',
      occurrenceStart: '2030-01-14T16:00:00.000Z',
      status: 'GOING',
      note: 'x',
    });
    expect(upsertCreate(prisma).note).toBeNull();
  });

  it('rejects a time that is not an occurrence', async () => {
    const service = new AttendanceService(makePrisma() as never);
    await expect(
      service.respond('p1', 'PLAYER', {
        practiceSlotId: 'slot1',
        occurrenceStart: '2030-01-15T16:00:00.000Z',
        status: 'GOING',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('answers a moved occurrence at its new time, not at the old one', async () => {
    const prisma = makePrisma();
    prisma.practiceSlotException.findMany.mockResolvedValue([
      {
        practiceSlotId: 'slot1',
        originalStart: new Date('2030-01-14T16:00:00.000Z'),
        cancelled: false,
        newStart: new Date('2030-01-16T17:00:00.000Z'),
        newEnd: new Date('2030-01-16T18:30:00.000Z'),
        reason: null,
      },
    ]);
    const service = new AttendanceService(prisma as never);
    const result = await service.respond('p1', 'PLAYER', {
      practiceSlotId: 'slot1',
      occurrenceStart: '2030-01-16T17:00:00.000Z',
      status: 'GOING',
    });
    expect(result.occurrenceKey).toBe('slot:slot1:2030-01-16T17:00:00.000Z');
    await expect(
      service.respond('p1', 'PLAYER', {
        practiceSlotId: 'slot1',
        occurrenceStart: '2030-01-14T16:00:00.000Z',
        status: 'GOING',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects answers for a cancelled occurrence', async () => {
    const prisma = makePrisma();
    prisma.practiceSlotException.findMany.mockResolvedValue([
      {
        practiceSlotId: 'slot1',
        originalStart: new Date('2030-01-14T16:00:00.000Z'),
        cancelled: true,
        newStart: null,
        newEnd: null,
        reason: 'Course closed',
      },
    ]);
    const service = new AttendanceService(prisma as never);
    await expect(
      service.respond('p1', 'PLAYER', {
        practiceSlotId: 'slot1',
        occurrenceStart: '2030-01-14T16:00:00.000Z',
        status: 'GOING',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects non-members, coaches and bad status', async () => {
    const prisma = makePrisma();
    prisma.teamMember.findFirst.mockResolvedValue(null);
    const service = new AttendanceService(prisma as never);
    const body = {
      practiceSlotId: 'slot1',
      occurrenceStart: '2030-01-14T16:00:00.000Z',
      status: 'GOING',
    };
    await expect(service.respond('p1', 'PLAYER', body)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.respond('c1', 'COACH', body)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      service.respond('p1', 'PLAYER', { ...body, status: 'YES' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects past sessions', async () => {
    const prisma = makePrisma();
    prisma.practiceSlot.findUnique.mockResolvedValue({
      ...weekly,
      startTime: new Date('2020-01-06T16:00:00Z'),
      endTime: new Date('2020-01-06T17:30:00Z'),
      recurrence: 'NONE',
    });
    const service = new AttendanceService(prisma as never);
    await expect(
      service.respond('p1', 'PLAYER', {
        practiceSlotId: 'slot1',
        occurrenceStart: '2020-01-06T16:00:00.000Z',
        status: 'GOING',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('loadAttendanceSummaries', () => {
  it('counts answers of current members and the open rest', async () => {
    const prisma = makePrisma();
    prisma.teamMember.findMany.mockResolvedValue([
      { teamId: 't1', userId: 'a' },
      { teamId: 't1', userId: 'b' },
      { teamId: 't1', userId: 'c' },
    ]);
    prisma.attendance.findMany.mockResolvedValue([
      { occurrenceKey: 'k', playerId: 'a', status: 'GOING', note: null },
      { occurrenceKey: 'k', playerId: 'b', status: 'NOT_GOING', note: 'sick' },
      { occurrenceKey: 'k', playerId: 'gone', status: 'GOING', note: null },
    ]);
    const result = await loadAttendanceSummaries(prisma as never, [
      { key: 'k', teamId: 't1' },
    ]);
    expect(result.get('k')).toMatchObject({
      going: 1,
      notGoing: 1,
      maybe: 0,
      open: 1,
      members: 3,
    });
  });
});
