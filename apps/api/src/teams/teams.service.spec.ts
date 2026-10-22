import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TeamsService', () => {
  const prisma = {
    team: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
    userClub: { findUnique: jest.fn() },
  };
  let service: TeamsService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new TeamsService(prisma as unknown as PrismaService);
    prisma.team.findUnique.mockResolvedValue({ id: 'team', coachId: 'coach' });
  });

  it('updateTeam only writes whitelisted fields (no coachId takeover)', async () => {
    await service.updateTeam('coach', 'team', {
      shortName: 'U18',
      coachId: 'attacker',
      id: 'other',
    } as never);
    const data = prisma.team.update.mock.calls[0][0].data;
    expect(data).toEqual({ shortName: 'U18' });
  });

  it('updateTeam rejects foreign clubs', async () => {
    prisma.userClub.findUnique.mockResolvedValue(null);
    await expect(
      service.updateTeam('coach', 'team', { clubId: 'foreign' }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.team.update).not.toHaveBeenCalled();
  });

  it('createTeam requires a non-empty name', async () => {
    await expect(
      service.createTeam('coach', { shortName: '  ' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('getClubUsers rejects clubs the coach is not a member of', async () => {
    prisma.userClub.findUnique.mockResolvedValue(null);
    await expect(service.getClubUsers('coach', 'foreign')).rejects.toThrow(
      ForbiddenException,
    );
  });
});
