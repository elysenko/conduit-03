import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProfilesService } from './profiles.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import type { ProfileView } from './profile.view';

@ApiTags('profiles')
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':username')
  get(
    @Param('username') username: string,
    @CurrentUser() user?: AuthUser,
  ): Promise<{ profile: ProfileView }> {
    return this.profiles.get(username, user?.id);
  }

  /** Following is idempotent, so it answers 200 rather than 201. */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post(':username/follow')
  follow(
    @Param('username') username: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ profile: ProfileView }> {
    return this.profiles.follow(user, username);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':username/follow')
  unfollow(
    @Param('username') username: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ profile: ProfileView }> {
    return this.profiles.unfollow(user, username);
  }
}
