import type { User } from '@prisma/client';

/** Matches the Angular `Profile` model (core/models.ts). */
export interface ProfileView {
  username: string;
  bio: string;
  image: string | null;
  following: boolean;
}

export type ProfileSource = Pick<User, 'id' | 'username' | 'bio' | 'image'>;

export const PROFILE_SELECT = {
  id: true,
  username: true,
  bio: true,
  image: true,
} as const;

export function toProfileView(
  user: ProfileSource,
  following: boolean,
): ProfileView {
  return {
    username: user.username,
    bio: user.bio ?? '',
    image: user.image ?? null,
    following,
  };
}
