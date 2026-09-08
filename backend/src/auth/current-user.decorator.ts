import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Role } from '@prisma/client';

/** Shape attached to `request.user` by JwtStrategy.validate(). */
export interface AuthUser {
  id: string;
  email: string;
  username: string;
  bio: string;
  image: string | null;
  role: Role;
}

/**
 * `@CurrentUser() user: AuthUser` on guarded routes.
 * On routes using OptionalJwtAuthGuard the parameter is `AuthUser | undefined`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return (request as Request & { user?: AuthUser }).user;
  },
);
