import type { PrismaService } from '../prisma/prisma.service';

/**
 * Who sees a lesson or journey template:
 * - PRIVATE: only the author
 * - CLUB:    the author and coaches who share at least one club with them
 * - PUBLIC:  every coach
 * Admins see everything.
 */
export type LibraryVisibility = 'PRIVATE' | 'CLUB' | 'PUBLIC';

/** Clubs of a user (user_clubs). */
export async function clubIdsOf(prisma: PrismaService, userId: string) {
  const rows = await prisma.userClub.findMany({
    where: { userId },
    select: { clubId: true },
  });
  return rows.map((row) => row.clubId);
}

/** Prisma `OR` for library items the user may see (lessons and journeys). */
export function libraryVisibleWhere(userId: string, clubIds: string[]) {
  return [
    { coachId: userId },
    { visibility: 'PUBLIC' as const },
    ...(clubIds.length
      ? [
          {
            visibility: 'CLUB' as const,
            coach: { userClubs: { some: { clubId: { in: clubIds } } } },
          },
        ]
      : []),
  ];
}

/** Pure check for one item, given the clubs of the viewer and the author. */
export function canSeeLibraryItem(input: {
  viewerId: string;
  viewerRole: string;
  viewerClubIds: string[];
  authorId: string;
  authorClubIds: string[];
  visibility: string;
}) {
  if (input.viewerRole === 'ADMIN') return true;
  if (input.authorId === input.viewerId) return true;
  if (input.visibility === 'PUBLIC') return true;
  if (input.visibility === 'CLUB') {
    const mine = new Set(input.viewerClubIds);
    return input.authorClubIds.some((clubId) => mine.has(clubId));
  }
  return false;
}

/** Loads both club lists and checks one item. */
export async function userCanSeeLibraryItem(
  prisma: PrismaService,
  viewer: { id: string; role: string },
  item: { coachId: string; visibility: string },
) {
  if (
    viewer.role === 'ADMIN' ||
    item.coachId === viewer.id ||
    item.visibility === 'PUBLIC'
  ) {
    return true;
  }
  if (item.visibility !== 'CLUB') return false;
  const [viewerClubIds, authorClubIds] = await Promise.all([
    clubIdsOf(prisma, viewer.id),
    clubIdsOf(prisma, item.coachId),
  ]);
  return canSeeLibraryItem({
    viewerId: viewer.id,
    viewerRole: viewer.role,
    viewerClubIds,
    authorId: item.coachId,
    authorClubIds,
    visibility: item.visibility,
  });
}

export function parseLibraryVisibility(
  value: unknown,
): LibraryVisibility | null {
  return value === 'PRIVATE' || value === 'CLUB' || value === 'PUBLIC'
    ? value
    : null;
}
