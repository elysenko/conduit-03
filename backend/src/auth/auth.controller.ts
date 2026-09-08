import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterEnvelopeDto } from './dto/register.dto';
import { LoginEnvelopeDto } from './dto/login.dto';
import { UpdateUserEnvelopeDto } from './dto/update-user.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser, type AuthUser } from './current-user.decorator';
import type { UserView } from './user.view';

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** POST /api/users — register. 409 when email or username is taken. */
  @Post('users')
  register(@Body() body: RegisterEnvelopeDto): Promise<{ user: UserView }> {
    return this.auth.register(body.user);
  }

  /** POST /api/users/login — 200 on success, 401 on mismatch. */
  @HttpCode(HttpStatus.OK)
  @Post('users/login')
  login(@Body() body: LoginEnvelopeDto): Promise<{ user: UserView }> {
    return this.auth.login(body.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('user')
  me(@CurrentUser() user: AuthUser): Promise<{ user: UserView }> {
    return this.auth.currentUser(user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put('user')
  update(
    @CurrentUser() user: AuthUser,
    @Body() body: UpdateUserEnvelopeDto,
  ): Promise<{ user: UserView }> {
    return this.auth.updateUser(user, body.user);
  }
}
