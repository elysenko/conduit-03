import { Prisma } from '@prisma/client';
import { PROFILE_SELECT, ProfileView, toProfileView } from '../profiles/profile.view';

/**
 * Everything the article view needs, in one query shape.
 * `_count.favorites` gives `favoritesCount` without loading the join rows.
 */
export const ARTICLE_INCLUDE = Prisma.validator<Prisma.ArticleInclude>()({
  author: { select: PROFILE_SELECT },
  tags: {
    select: { tag: { select: { name: true } } },
    orderBy: { tag: { name: 'asc' } },
  },
  _count: { select: { favorites: true } },
});

export type ArticleWithRelations = Prisma.ArticleGetPayload<{
  include: typeof ARTICLE_INCLUDE;
}>;

/** Matches the Angular `Article` model (core/models.ts). */
export interface ArticleView {
  slug: string;
  title: string;
  description: string;
  body: string;
  tagList: string[];
  createdAt: string;
  updatedAt: string;
  favorited: boolean;
  favoritesCount: number;
  author: ProfileView;
}

export function toArticleView(
  article: ArticleWithRelations,
  flags: { favorited: boolean; following: boolean },
): ArticleView {
  return {
    slug: article.slug,
    title: article.title,
    description: article.description,
    body: article.body,
    tagList: article.tags.map((link) => link.tag.name),
    createdAt: article.createdAt.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
    favorited: flags.favorited,
    favoritesCount: article._count.favorites,
    author: toProfileView(article.author, flags.following),
  };
}
