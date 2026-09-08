import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { uniqueSlug } from '../common/slug.util';
import {
  favoritedArticleIds,
  followedUserIds,
} from '../common/relations.util';
import {
  ARTICLE_INCLUDE,
  ArticleView,
  ArticleWithRelations,
  toArticleView,
} from './article.view';
import { ListArticlesQuery } from './dto/list-articles.query';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import type { AuthUser } from '../auth/current-user.decorator';

export interface ArticleListResponse {
  articles: ArticleView[];
  articlesCount: number;
}

@Injectable()
export class ArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── views ────────────────────────────────────────────────────────────────

  /** Resolve per-viewer flags for a page of articles in two extra queries. */
  private async toViews(
    articles: ArticleWithRelations[],
    currentUserId?: string,
  ): Promise<ArticleView[]> {
    const [favorited, following] = await Promise.all([
      favoritedArticleIds(
        this.prisma,
        currentUserId,
        articles.map((a) => a.id),
      ),
      followedUserIds(
        this.prisma,
        currentUserId,
        articles.map((a) => a.author.id),
      ),
    ]);
    return articles.map((article) =>
      toArticleView(article, {
        favorited: favorited.has(article.id),
        following: following.has(article.author.id),
      }),
    );
  }

  private async toView(
    article: ArticleWithRelations,
    currentUserId?: string,
  ): Promise<{ article: ArticleView }> {
    const [view] = await this.toViews([article], currentUserId);
    return { article: view };
  }

  // ── reads ────────────────────────────────────────────────────────────────

  private async page(
    where: Prisma.ArticleWhereInput,
    query: ListArticlesQuery,
    currentUserId?: string,
  ): Promise<ArticleListResponse> {
    const [rows, articlesCount] = await this.prisma.$transaction([
      this.prisma.article.findMany({
        where,
        include: ARTICLE_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: query.limit ?? 20,
        skip: query.offset ?? 0,
      }),
      this.prisma.article.count({ where }),
    ]);
    return { articles: await this.toViews(rows, currentUserId), articlesCount };
  }

  async list(
    query: ListArticlesQuery,
    currentUserId?: string,
  ): Promise<ArticleListResponse> {
    const where: Prisma.ArticleWhereInput = {};
    if (query.tag) {
      // `some` on the relation — an article carrying several matched tags is
      // returned once, unlike a raw join.
      where.tags = { some: { tag: { name: query.tag } } };
    }
    if (query.author) {
      where.author = { username: query.author };
    }
    if (query.favorited) {
      where.favorites = { some: { user: { username: query.favorited } } };
    }
    return this.page(where, query, currentUserId);
  }

  /** Articles authored by people the current user follows. */
  async feed(
    query: ListArticlesQuery,
    current: AuthUser,
  ): Promise<ArticleListResponse> {
    const where: Prisma.ArticleWhereInput = {
      author: { followers: { some: { followerId: current.id } } },
    };
    return this.page(where, query, current.id);
  }

  private async findBySlugOrThrow(slug: string): Promise<ArticleWithRelations> {
    const article = await this.prisma.article.findUnique({
      where: { slug },
      include: ARTICLE_INCLUDE,
    });
    if (!article) {
      throw new NotFoundException(`Article "${slug}" not found`);
    }
    return article;
  }

  async findOne(
    slug: string,
    currentUserId?: string,
  ): Promise<{ article: ArticleView }> {
    return this.toView(await this.findBySlugOrThrow(slug), currentUserId);
  }

  // ── writes ───────────────────────────────────────────────────────────────

  /**
   * Existence first, then ownership: a missing slug must be 404 even for a
   * non-owner, and 403 must be raised before any mutation runs.
   */
  private async findOwnedOrThrow(
    slug: string,
    current: AuthUser,
  ): Promise<ArticleWithRelations> {
    const article = await this.findBySlugOrThrow(slug);
    if (article.authorId !== current.id) {
      throw new ForbiddenException('You are not the author of this article');
    }
    return article;
  }

  private normalizeTags(tagList?: string[]): string[] {
    if (!tagList) {
      return [];
    }
    const cleaned = tagList
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => tag.length > 0);
    return Array.from(new Set(cleaned));
  }

  /** Upsert the tags and (re)link them to the article. */
  private async syncTags(articleId: string, tagList: string[]): Promise<void> {
    for (const name of tagList) {
      const tag = await this.prisma.tag.upsert({
        where: { name },
        update: {},
        create: { name },
        select: { id: true },
      });
      await this.prisma.articleTag.upsert({
        where: { articleId_tagId: { articleId, tagId: tag.id } },
        update: {},
        create: { articleId, tagId: tag.id },
      });
    }
    await this.prisma.articleTag.deleteMany({
      where: { articleId, tag: { name: { notIn: tagList } } },
    });
  }

  async create(
    current: AuthUser,
    dto: CreateArticleDto,
  ): Promise<{ article: ArticleView }> {
    const slug = await this.nextSlug(dto.title);
    const created = await this.prisma.article.create({
      data: {
        slug,
        title: dto.title.trim(),
        description: dto.description.trim(),
        body: dto.body,
        authorId: current.id,
      },
      select: { id: true },
    });
    await this.syncTags(created.id, this.normalizeTags(dto.tagList));
    return this.toView(await this.findBySlugOrThrow(slug), current.id);
  }

  private nextSlug(title: string): Promise<string> {
    return uniqueSlug(title, async (candidate) => {
      const existing = await this.prisma.article.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      return existing !== null;
    });
  }

  async update(
    current: AuthUser,
    slug: string,
    dto: UpdateArticleDto,
  ): Promise<{ article: ArticleView }> {
    const article = await this.findOwnedOrThrow(slug, current);

    const data: Prisma.ArticleUpdateInput = {};
    let nextSlug = article.slug;
    if (dto.title !== undefined && dto.title.trim() !== article.title) {
      data.title = dto.title.trim();
      // Regenerate the slug only when the title actually changes; the client
      // navigates to the slug returned here.
      nextSlug = await this.nextSlug(dto.title);
      data.slug = nextSlug;
    }
    if (dto.description !== undefined) {
      data.description = dto.description.trim();
    }
    if (dto.body !== undefined) {
      data.body = dto.body;
    }

    await this.prisma.article.update({ where: { id: article.id }, data });
    if (dto.tagList !== undefined) {
      await this.syncTags(article.id, this.normalizeTags(dto.tagList));
    }
    return this.toView(await this.findBySlugOrThrow(nextSlug), current.id);
  }

  async remove(current: AuthUser, slug: string): Promise<void> {
    const article = await this.findOwnedOrThrow(slug, current);
    await this.prisma.article.delete({ where: { id: article.id } });
  }

  // ── favorites ────────────────────────────────────────────────────────────

  async favorite(
    current: AuthUser,
    slug: string,
  ): Promise<{ article: ArticleView }> {
    const article = await this.findBySlugOrThrow(slug);
    try {
      await this.prisma.favorite.create({
        data: { userId: current.id, articleId: article.id },
      });
    } catch (error) {
      // Already favorited — the endpoint is idempotent.
      if (
        !(
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        )
      ) {
        throw error;
      }
    }
    return this.toView(await this.findBySlugOrThrow(slug), current.id);
  }

  async unfavorite(
    current: AuthUser,
    slug: string,
  ): Promise<{ article: ArticleView }> {
    const article = await this.findBySlugOrThrow(slug);
    await this.prisma.favorite.deleteMany({
      where: { userId: current.id, articleId: article.id },
    });
    return this.toView(await this.findBySlugOrThrow(slug), current.id);
  }
}
