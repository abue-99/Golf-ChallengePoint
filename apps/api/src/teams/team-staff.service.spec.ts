import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

import { assertTeamAccess, coachTeamsWhere } from './team-access';
import { TeamStaffService } from './team-staff.service';

type StaffRow = { coachId: string; role: string; id?: string };

function makePrisma(
  staff: StaffRow[] = [{ coachId: 'assist', role: 'FITNESS' }],
) {
  const coach = (id: string) => ({
    id,
    firstName: id,
    lastName: null,
    email: `${id}@x.de`,
    profileImage: null,
  });
  const prisma = {
    team: {
      findUnique: jest.fn().mockImplementation(({ select }) => {
        if (select?.staff?.where) {
          const coachId = select.staff.where.coachId as string;
          return Promise.resolve({
            id: 't1',
            coachId: 'head',
            shortName: 'U16',
            clubId: 'club1',
            staff: staff
              .filter((row) => row.coachId === coachId)
              .map((row) => ({ role: row.role })),
          });
        }
        return Promise.resolve({
          coach: coach('head'),
          staff: staff.map((row) => ({
            role: row.role,
            createdAt: new Date(),
            coach: coach(row.coachId),
          })),
        });
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    teamCoach: {
      findMany: jest
        .fn()
        .mockResolvedValue(staff.map((row) => ({ coachId: row.coachId }))),
      findUnique: jest
        .fn()
        .mockImplementation(({ where }) =>
          Promise.resolve(
            staff.find((row) => row.coachId === where.teamId_coachId.coachId)
              ? { id: 'tc1' }
              : null,
          ),
        ),
      create: jest.fn().mockResolvedValue({}),
      upsert: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockImplementation(({ where }) =>
        Promise.resolve({
          count: staff.some((row) => row.coachId === where.coachId) ? 1 : 0,
        }),
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([coach('newcoach')]),
    },
    userClub: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
    Promise.resolve(fn(prisma)),
  );
  return prisma;
}

describe('coachTeamsWhere', () => {
  it('matches head coach and staff', () => {
    expect(coachTeamsWhere('c1')).toEqual({
      OR: [{ coachId: 'c1' }, { staff: { some: { coachId: 'c1' } } }],
    });
  });
});

describe('assertTeamAccess', () => {
  it('knows head coach, staff, admins and strangers', async () => {
    const prisma = makePrisma();
    await expect(
      assertTeamAccess(prisma as never, 'head', 'COACH', 't1'),
    ).resolves.toMatchObject({ isHead: true, role: 'HEAD_COACH' });
    await expect(
      assertTeamAccess(prisma as never, 'assist', 'COACH', 't1'),
    ).resolves.toMatchObject({ isHead: false, role: 'FITNESS' });
    await expect(
      assertTeamAccess(prisma as never, 'admin', 'ADMIN', 't1'),
    ).resolves.toMatchObject({ isHead: true, role: null });
    await expect(
      assertTeamAccess(prisma as never, 'other', 'COACH', 't1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('TeamStaffService', () => {
  it('lists the head coach first', async () => {
    const service = new TeamStaffService(makePrisma() as never);
    const result = await service.list('assist', 'COACH', 't1');
    expect(result.isHeadCoach).toBe(false);
    expect(result.myRole).toBe('FITNESS');
    expect(result.staff.map((m) => [m.coachId, m.role])).toEqual([
      ['head', 'HEAD_COACH'],
      ['assist', 'FITNESS'],
    ]);
  });

  it('lets only the head coach add club coaches', async () => {
    const prisma = makePrisma();
    const service = new TeamStaffService(prisma as never);
    await expect(
      service.add('assist', 'COACH', 't1', { coachId: 'newcoach' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.add('head', 'COACH', 't1', { coachId: 'stranger' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.add('head', 'COACH', 't1', {
        coachId: 'newcoach',
        role: 'HEAD_COACH',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await service.add('head', 'COACH', 't1', {
      coachId: 'newcoach',
      role: 'MENTAL',
    });
    expect(prisma.teamCoach.create).toHaveBeenCalledWith({
      data: { teamId: 't1', coachId: 'newcoach', role: 'MENTAL' },
    });
  });

  it('lets staff leave but not remove others; the head cannot leave', async () => {
    const service = new TeamStaffService(makePrisma() as never);
    await expect(
      service.remove('assist', 'COACH', 't1', 'assist'),
    ).resolves.toEqual({ ok: true, left: true });
    await expect(
      service.remove('assist', 'COACH', 't1', 'someone'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.remove('head', 'COACH', 't1', 'head'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.remove('head', 'COACH', 't1', 'unknown'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('hands the team over to a staff member', async () => {
    const prisma = makePrisma();
    const service = new TeamStaffService(prisma as never);
    await expect(
      service.transferHead('head', 'COACH', 't1', 'unknown'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await service.transferHead('head', 'COACH', 't1', 'assist');
    expect(prisma.team.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { coachId: 'assist' },
    });
    expect(prisma.teamCoach.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { teamId: 't1', coachId: 'head', role: 'ASSISTANT' },
      }),
    );
  });
});
