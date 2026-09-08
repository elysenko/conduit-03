import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  PROFILE_SELECT,
  ProfileView,
  toProfileView,
} from './profile.view';
import type { AuthUser } from '../auth/current-user.decorator';

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  private async findByUsernameOrThrow(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: PROFILE_SELECT,
    });
    if (!user) {
      throw new NotFoundException(`Profile "${username}" not found`);
    }
    return user;
  }

  private async isFollowing(
    followerId: string | undefined,
    followedId: string,
  ): Promise<boolean> {
    if (!followerId || followerId === followedId) {
      return false;
    }
    const row = await this.prisma.follow.findUnique({
      where: { followerId_followedId: { followerId, followedId } },
      select: { followerId: true },
    });
    return row !== null;
  }

  async get(
    username: string,
    currentUserId?: string,
  ): Promise<{ profile: ProfileView }> {
    const user = await this.findByUsernameOrThrow(username);
    return {
      profile: toProfileView(user, await this.isFollowing(currentUserId, user.id)),
    };
  }

  async follow(
    current: AuthUser,
    username: string,
  ): Promise<{ profile: ProfileView }> {
    const target = await this.findByUsernameOrThrow(username);
    if (target.id === current.id) {
      throw new UnprocessableEntityException('You cannot follow yourself');
    }
    try {
      await this.prisma.follow.create({
        data: { followerId: current.id, followedId: target.id },
      });
    } catch (error) {
      // Already following — follow is idempotent.
      if (
        !(
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        )
      ) {
        throw error;
      }
    }
    return { profile: toProfileView(target, true) };
  }

  async unfollow(
    current: AuthUser,
    username: string,
  ): Promise<{ profile: ProfileView }> {
    const target = await this.findByUsernameOrThrow(username);
    // deleteMany: a no-op delete must not 404.
    await this.prisma.follow.deleteMany({
      where: { followerId: current.id, followedId: target.id },
    });
    return { profile: toProfileView(target, false) };
  }
}
