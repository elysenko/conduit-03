import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CommentsService, type CommentView } from './comments.service';
import { CreateCommentEnvelopeDto } from './dto/create-comment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';

@ApiTags('comments')
@Controller('articles/:slug/comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  list(
    @Param('slug') slug: string,
    @CurrentUser() user?: AuthUser,
  ): Promise<{ comments: CommentView[] }> {
    return this.comments.list(slug, user?.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Param('slug') slug: string,
    @Body() body: CreateCommentEnvelopeDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ comment: CommentView }> {
    return this.comments.create(user, slug, body.comment);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ id: string }> {
    await this.comments.remove(user, slug, id);
    return { id };
  }
}
