import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ArticleListResponse, ArticlesService } from './articles.service';
import { ListArticlesQuery } from './dto/list-articles.query';
import { CreateArticleEnvelopeDto } from './dto/create-article.dto';
import { UpdateArticleEnvelopeDto } from './dto/update-article.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import type { ArticleView } from './article.view';

@ApiTags('articles')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  list(
    @Query() query: ListArticlesQuery,
    @CurrentUser() user?: AuthUser,
  ): Promise<ArticleListResponse> {
    return this.articles.list(query, user?.id);
  }

  /** Declared before ':slug' so "feed" is not swallowed as a slug. */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('feed')
  feed(
    @Query() query: ListArticlesQuery,
    @CurrentUser() user: AuthUser,
  ): Promise<ArticleListResponse> {
    return this.articles.feed(query, user);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':slug')
  findOne(
    @Param('slug') slug: string,
    @CurrentUser() user?: AuthUser,
  ): Promise<{ article: ArticleView }> {
    return this.articles.findOne(slug, user?.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Body() body: CreateArticleEnvelopeDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ article: ArticleView }> {
    return this.articles.create(user, body.article);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put(':slug')
  update(
    @Param('slug') slug: string,
    @Body() body: UpdateArticleEnvelopeDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ article: ArticleView }> {
    return this.articles.update(user, slug, body.article);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':slug')
  async remove(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ slug: string }> {
    await this.articles.remove(user, slug);
    return { slug };
  }

  /** Favoriting is idempotent, so it answers 200 rather than 201. */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post(':slug/favorite')
  favorite(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ article: ArticleView }> {
    return this.articles.favorite(user, slug);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':slug/favorite')
  unfavorite(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ article: ArticleView }> {
    return this.articles.unfavorite(user, slug);
  }
}
