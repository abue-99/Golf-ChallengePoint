jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

import {
  canSeeLibraryItem,
  libraryVisibleWhere,
  parseLibraryVisibility,
  userCanSeeLibraryItem,
} from './library-access';

const base = {
  viewerId: 'v',
  viewerRole: 'COACH',
  viewerClubIds: ['club-a'],
  authorId: 'x',
  authorClubIds: ['club-b'],
};

describe('canSeeLibraryItem', () => {
  it('shows own, public and same-club items only', () => {
    expect(canSeeLibraryItem({ ...base, visibility: 'PUBLIC' })).toBe(true);
    expect(canSeeLibraryItem({ ...base, visibility: 'PRIVATE' })).toBe(false);
    expect(canSeeLibraryItem({ ...base, visibility: 'CLUB' })).toBe(false);
    expect(
      canSeeLibraryItem({
        ...base,
        authorClubIds: ['club-b', 'club-a'],
        visibility: 'CLUB',
      }),
    ).toBe(true);
    expect(
      canSeeLibraryItem({ ...base, authorId: 'v', visibility: 'PRIVATE' }),
    ).toBe(true);
    expect(
      canSeeLibraryItem({
        ...base,
        viewerRole: 'ADMIN',
        visibility: 'PRIVATE',
      }),
    ).toBe(true);
  });
});

describe('libraryVisibleWhere', () => {
  it('adds the club condition only when the coach has clubs', () => {
    expect(libraryVisibleWhere('v', [])).toEqual([
      { coachId: 'v' },
      { visibility: 'PUBLIC' },
    ]);
    expect(libraryVisibleWhere('v', ['c1'])[2]).toEqual({
      visibility: 'CLUB',
      coach: { userClubs: { some: { clubId: { in: ['c1'] } } } },
    });
  });
});

describe('userCanSeeLibraryItem', () => {
  it('loads both club lists for club items', async () => {
    const prisma = {
      userClub: {
        findMany: jest.fn(({ where }: { where: { userId: string } }) =>
          Promise.resolve(
            where.userId === 'v'
              ? [{ clubId: 'c1' }]
              : [{ clubId: 'c2' }, { clubId: 'c1' }],
          ),
        ),
      },
    };
    await expect(
      userCanSeeLibraryItem(
        prisma as never,
        { id: 'v', role: 'COACH' },
        { coachId: 'x', visibility: 'CLUB' },
      ),
    ).resolves.toBe(true);
    // Public needs no lookup.
    prisma.userClub.findMany.mockClear();
    await expect(
      userCanSeeLibraryItem(
        prisma as never,
        { id: 'v', role: 'COACH' },
        { coachId: 'x', visibility: 'PUBLIC' },
      ),
    ).resolves.toBe(true);
    expect(prisma.userClub.findMany).not.toHaveBeenCalled();
  });

  it('parses visibilities', () => {
    expect(parseLibraryVisibility('CLUB')).toBe('CLUB');
    expect(parseLibraryVisibility('TEAM')).toBeNull();
  });
});
