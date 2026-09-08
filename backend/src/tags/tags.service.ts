import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const POPULAR_TAG_LIMIT = 20;

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tag names ordered by how many articles carry them, most used first.
   * Backs the "Popular Tags" sidebar; capped at 20.
   */
  async popular(): Promise<{ tags: string[] }> {
    const grouped = await this.prisma.articleTag.groupBy({
      by: ['tagId'],
      _count: { tagId: true },
      orderBy: { _count: { tagId: 'desc' } },
      take: POPULAR_TAG_LIMIT,
    });
    if (grouped.length === 0) {
      return { tags: [] };
    }

    const names = await this.prisma.tag.findMany({
      where: { id: { in: grouped.map((row) => row.tagId) } },
      select: { id: true, name: true },
    });
    const byId = new Map(names.map((tag) => [tag.id, tag.name]));

    // Re-apply the usage ordering lost by the id-based lookup.
    const tags = grouped
      .map((row) => byId.get(row.tagId))
      .filter((name): name is string => Boolean(name));
    return { tags };
  }
}
