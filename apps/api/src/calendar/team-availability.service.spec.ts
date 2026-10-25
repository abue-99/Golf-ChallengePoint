import { BadRequestException, ForbiddenException } from '@nestjs/common';
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));
jest.mock('@challengepoint/db', () => ({
  OwnerType: { TEAM: 'TEAM', PLAYER: 'PLAYER' },
}));
const assertTeamAccess = jest.fn(() => Promise.resolve({ isHead: false }));
jest.mock('../teams/team-access', () => ({
  assertTeamAccess: (...args: unknown[]) =>
    (assertTeamAccess as (...a: unknown[]) => Promise<unknown>)(...args),
}));

import { TeamAvailabilityService } from './team-availability.service';

const FROM = '2030-01-07T00:00:00.000Z'; // Monday
const TO = '2030-01-14T00:00:00.000Z';

function setup() {
  const prisma = {
    team: {
      findUnique: jest.fn().mockResolvedValue({
        id: 't1',
        shortName: 'U16',
        members: [
          {
            user: {
              id: 'p1',
              firstName: 'Max',
              lastName: 'Muster',
              email: 'max@test.de',
              role: 'PLAYER',
            },
          },
          {
            user: {
              id: 'p2',
              firstName: 'Lea',
              lastName: null,
              email: 'lea@test.de',
              role: 'PLAYER',
            },
          },
          {
            user: {
              id: 'c1',
              firstName: 'C',
              lastName: null,
              email: 'c@test.de',
              role: 'COACH',
            },
          },
        ],
      }),
    },
    teamMember: {
      findMany: jest.fn().mockResolvedValue([
        { userId: 'p1', teamId: 't1', team: { shortName: 'U16' } },
        { userId: 'p2', teamId: 't1', team: { shortName: 'U16' } },
        { userId: 'p2', teamId: 't2', team: { shortName: 'Girls' } },
      ]),
    },
    availabilityBlock: {
      findMany: jest.fn().mockResolvedValue([
        {
          playerId: 'p1',
          title: 'School',
          type: 'SCHOOL',
          // Every weekday-Monday 08:00–15:00, started weeks ago (no DST change in between).
          startTime: new Date('2029-11-05T08:00:00Z'),
          endTime: new Date('2029-11-05T15:00:00Z'),
          recurrence: 'WEEKLY',
          recurrenceEndDate: null,
        },
      ]),
    },
    tournament: {
      findMany: jest.fn().mockResolvedValue([
        {
          playerId: 'p1',
          title: 'Club championship',
          startTime: new Date('2030-01-12T08:00:00Z'),
          endTime: new Date('2030-01-14T18:00:00Z'),
        },
      ]),
    },
    practiceSlot: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 's2',
          teamId: 't2',
          title: 'Training',
          startTime: new Date('2029-12-04T16:00:00Z'),
          endTime: new Date('2029-12-04T17:30:00Z'),
          recurrence: 'WEEKLY',
          recurrenceEndDate: null,
        },
      ]),
    },
    practiceSlotException: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    teamEvent: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return {
    prisma,
    service: new TeamAvailabilityService(prisma as never),
  };
}

describe('TeamAvailabilityService', () => {
  it('collects absences, tournaments and trainings of all teams per player', async () => {
    const { service } = setup();
    const result = await service.getAvailability('c1', 'COACH', 't1', {
      from: FROM,
      to: TO,
    });
    expect(result.members.map((m) => m.name)).toEqual(['Max Muster', 'Lea']);
    const max = result.members[0].busy;
    expect(max.map((b) => [b.kind, b.label, b.start])).toEqual([
      ['absence', 'School', '2030-01-07T08:00:00.000Z'],
      ['tournament', 'Club championship', '2030-01-12T08:00:00.000Z'],
    ]);
    // The tournament is clipped to the range end.
    expect(max[1].end).toBe(TO);
    const lea = result.members[1].busy;
    expect(lea).toEqual([
      expect.objectContaining({
        kind: 'team-training',
        label: 'Training (Girls)',
        start: '2030-01-08T16:00:00.000Z',
      }),
    ]);
  });

  it('skips cancelled dates of trainings', async () => {
    const { prisma, service } = setup();
    prisma.practiceSlotException.findMany.mockResolvedValue([
      {
        practiceSlotId: 's2',
        originalStart: new Date('2030-01-08T16:00:00Z'),
        cancelled: true,
        newStart: null,
        newEnd: null,
        reason: null,
      },
    ]);
    const result = await service.getAvailability('c1', 'COACH', 't1', {
      from: FROM,
      to: TO,
    });
    expect(result.members[1].busy).toEqual([]);
  });

  it('checks role, team access and range', async () => {
    const { service } = setup();
    await expect(
      service.getAvailability('p1', 'PLAYER', 't1', {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.getAvailability('c1', 'COACH', 't1', {
        from: FROM,
        to: '2030-03-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    assertTeamAccess.mockRejectedValueOnce(new ForbiddenException());
    await expect(
      service.getAvailability('x', 'COACH', 't1', { from: FROM, to: TO }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
