import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService authorization', () => {
  const prisma = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    userClub: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  let service: UsersService;
  const admin = { id: 'admin', role: 'ADMIN' };
  const sys = { id: 'sys', role: 'SYSADMIN' };

  beforeEach(() => {
    jest.resetAllMocks();
    service = new UsersService(prisma as unknown as PrismaService);
    prisma.userClub.findMany.mockResolvedValue([{ clubId: 'c1' }]);
  });

  const target = (role: string, extra: Record<string, unknown> = {}) =>
    prisma.user.findUnique.mockResolvedValue({
      id: 't',
      role,
      lastLogin: null,
      ...extra,
    });

  it('ADMIN cannot manage a SYSADMIN', async () => {
    target('SYSADMIN');
    await expect(
      service.assertCanManageUser(admin, 't', 'role'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('ADMIN cannot manage users outside their clubs', async () => {
    target('PLAYER');
    prisma.userClub.findFirst.mockResolvedValue(null);
    await expect(
      service.assertCanManageUser(admin, 't', 'profile'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('ADMIN can manage users of their own club', async () => {
    target('COACH');
    prisma.userClub.findFirst.mockResolvedValue({ userId: 't' });
    await expect(
      service.assertCanManageUser(admin, 't', 'role'),
    ).resolves.toBeTruthy();
  });

  it('ADMIN cannot delete another ADMIN', async () => {
    target('ADMIN');
    prisma.userClub.findFirst.mockResolvedValue({ userId: 't' });
    await expect(
      service.assertCanManageUser(admin, 't', 'delete'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('nobody can delete or re-role themselves', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'sys', role: 'SYSADMIN' });
    await expect(
      service.assertCanManageUser(sys, 'sys', 'delete'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('SYSADMIN can manage any other user', async () => {
    target('ADMIN');
    await expect(
      service.assertCanManageUser(sys, 't', 'delete'),
    ).resolves.toBeTruthy();
  });

  it('resendInvite refuses users that already logged in', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 't',
      lastLogin: new Date(),
    });
    await expect(service.resendInvite('t')).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
