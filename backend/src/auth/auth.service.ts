import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BCRYPT_ROUNDS, JWT_EXPIRES_IN } from './auth.constants';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { userEnvelope, UserView } from './user.view';
import type { AuthUser } from './current-user.decorator';

const USER_SELECT = {
  id: true,
  email: true,
  username: true,
  bio: true,
  image: true,
  role: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private sign(user: {
    id: string;
    username: string;
    role: string;
  }): Promise<string> {
    return this.jwt.signAsync(
      { sub: user.id, username: user.username, role: user.role },
      { expiresIn: JWT_EXPIRES_IN },
    );
  }

  async register(dto: RegisterDto): Promise<{ user: UserView }> {
    const email = dto.email.trim().toLowerCase();
    const username = dto.username.trim();

    const clash = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { email: true, username: true },
    });
    if (clash) {
      throw new ConflictException(
        clash.email === email ? 'email has already been taken' : 'username has already been taken',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    try {
      const user = await this.prisma.user.create({
        data: { email, username, name: username, passwordHash },
        select: USER_SELECT,
      });
      return userEnvelope(user, await this.sign(user));
    } catch (error) {
      // Lost the race against a concurrent signup on the same unique index.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('email or username has already been taken');
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<{ user: UserView }> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { ...USER_SELECT, passwordHash: true },
    });
    // Same message either way so the endpoint does not enumerate accounts.
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('email or password is invalid');
    }
    const { passwordHash: _passwordHash, ...rest } = user;
    return userEnvelope(rest, await this.sign(rest));
  }

  /** GET /api/user — re-issues a token so an active session keeps rolling. */
  async currentUser(current: AuthUser): Promise<{ user: UserView }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: current.id },
      select: USER_SELECT,
    });
    return userEnvelope(user, await this.sign(user));
  }

  async updateUser(
    current: AuthUser,
    dto: UpdateUserDto,
  ): Promise<{ user: UserView }> {
    const data: Prisma.UserUpdateInput = {};

    if (dto.email !== undefined) {
      data.email = dto.email.trim().toLowerCase();
    }
    if (dto.username !== undefined) {
      data.username = dto.username.trim();
    }
    if (dto.bio !== undefined) {
      data.bio = dto.bio;
    }
    if (dto.image !== undefined) {
      data.image = dto.image.trim() === '' ? null : dto.image.trim();
    }
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    }

    if (data.email || data.username) {
      const clash = await this.prisma.user.findFirst({
        where: {
          id: { not: current.id },
          OR: [
            ...(data.email ? [{ email: data.email as string }] : []),
            ...(data.username ? [{ username: data.username as string }] : []),
          ],
        },
        select: { email: true },
      });
      if (clash) {
        throw new ConflictException('email or username has already been taken');
      }
    }

    const user = await this.prisma.user.update({
      where: { id: current.id },
      data,
      select: USER_SELECT,
    });
    return userEnvelope(user, await this.sign(user));
  }
}
