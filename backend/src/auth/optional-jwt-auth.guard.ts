import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Attaches `request.user` when a valid token is present and lets the request
 * through untouched otherwise. Used on every public GET so `favorited` and
 * `following` resolve for signed-in readers without locking anonymous ones out.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context);
    } catch {
      // An absent or invalid token is not an error on these routes.
    }
    return true;
  }

  handleRequest<TUser>(_err: unknown, user: TUser): TUser {
    return (user || undefined) as TUser;
  }
}
