import { PrismaService } from '../prisma/prisma.service';

/**
 * Batch lookups used to resolve the per-viewer `following` / `favorited` flags
 * for a page of articles or comments in two queries instead of N.
 */

/** Ids among `userIds` that `currentUserId` follows. Empty when anonymous. */
export async function followedUserIds(
  prisma: PrismaService,
  currentUserId: string | undefined,
  userIds: string[],
): Promise<Set<string>> {
  if (!currentUserId || userIds.length === 0) {
    return new Set();
  }
  const rows = await prisma.follow.findMany({
    where: { followerId: currentUserId, followedId: { in: userIds } },
    select: { followedId: true },
  });
  return new Set(rows.map((row) => row.followedId));
}

/** Ids among `articleIds` that `currentUserId` has favorited. */
export async function favoritedArticleIds(
  prisma: PrismaService,
  currentUserId: string | undefined,
  articleIds: string[],
): Promise<Set<string>> {
  if (!currentUserId || articleIds.length === 0) {
    return new Set();
  }
  const rows = await prisma.favorite.findMany({
    where: { userId: currentUserId, articleId: { in: articleIds } },
    select: { articleId: true },
  });
  return new Set(rows.map((row) => row.articleId));
}
