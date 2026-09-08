import type { Role, User } from '@prisma/client';

/** Response shape consumed by the Angular `User` model (core/models.ts). */
export interface UserView {
  id: string;
  email: string;
  username: string;
  bio: string;
  image: string | null;
  role: Role;
  token?: string;
}

export type UserForView = Pick<
  User,
  'id' | 'email' | 'username' | 'bio' | 'image' | 'role'
>;

export function toUserView(user: UserForView, token?: string): UserView {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    bio: user.bio ?? '',
    image: user.image ?? null,
    ...(token ? { token } : {}),
    role: user.role,
  };
}

/** Every auth endpoint answers with the RealWorld `{ user: ... }` envelope. */
export function userEnvelope(
  user: UserForView,
  token?: string,
): { user: UserView } {
  return { user: toUserView(user, token) };
}
