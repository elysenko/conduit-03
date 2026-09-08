import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { followedUserIds } from '../common/relations.util';
import {
  PROFILE_SELECT,
  ProfileView,
  toProfileView,
} from '../profiles/profile.view';
import { CreateCommentDto } from './dto/create-comment.dto';
import type { AuthUser } from '../auth/current-user.decorator';

/** Matches the Angular `Comment` model (core/models.ts). */
export interface CommentView {
  id: string;
  body: string;
  createdAt: string;
  author: ProfileView;
}

const COMMENT_INCLUDE = Prisma.validator<Prisma.CommentInclude>()({
  author: { select: PROFILE_SELECT },
});

type CommentWithAuthor = Prisma.CommentGetPayload<{
  include: typeof COMMENT_INCLUDE;
}>;

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async articleIdOrThrow(slug: string): Promise<string> {
    const article = await this.prisma.article.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!article) {
      throw new NotFoundException(`Article "${slug}" not found`);
    }
    return article.id;
  }

  private async toViews(
    comments: CommentWithAuthor[],
    currentUserId?: string,
  ): Promise<CommentView[]> {
    const following = await followedUserIds(
      this.prisma,
      currentUserId,
      comments.map((comment) => comment.author.id),
    );
    return comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      author: toProfileView(comment.author, following.has(comment.author.id)),
    }));
  }

  async list(
    slug: string,
    currentUserId?: string,
  ): Promise<{ comments: CommentView[] }> {
    const articleId = await this.articleIdOrThrow(slug);
    const rows = await this.prisma.comment.findMany({
      where: { articleId },
      include: COMMENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return { comments: await this.toViews(rows, currentUserId) };
  }

  async create(
    current: AuthUser,
    slug: string,
    dto: CreateCommentDto,
  ): Promise<{ comment: CommentView }> {
    const articleId = await this.articleIdOrThrow(slug);
    const created = await this.prisma.comment.create({
      data: { articleId, authorId: current.id, body: dto.body.trim() },
      include: COMMENT_INCLUDE,
    });
    const [view] = await this.toViews([created], current.id);
    return { comment: view };
  }

  /** 404 for an unknown comment, 403 for someone else's — existence first. */
  async remove(current: AuthUser, slug: string, id: string): Promise<void> {
    const articleId = await this.articleIdOrThrow(slug);
    const comment = await this.prisma.comment.findFirst({
      where: { id, articleId },
      select: { id: true, authorId: true },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.authorId !== current.id) {
      throw new ForbiddenException('You are not the author of this comment');
    }
    await this.prisma.comment.delete({ where: { id: comment.id } });
  }
}
