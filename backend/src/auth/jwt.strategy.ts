import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptionsWithoutRequest } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { JWT_ALGORITHM, jwtSecret } from './auth.constants';
import type { AuthUser } from './current-user.decorator';

export interface JwtPayload {
  sub: string;
  username: string;
  role: string;
}

/**
 * RealWorld clients send `Authorization: Token <jwt>`; this app's Angular
 * interceptor sends `Bearer <jwt>`. Accept both.
 */
function fromTokenScheme(req: Request): string | null {
  const header = req.headers?.authorization;
  if (!header) {
    return null;
  }
  const [scheme, value] = header.split(' ');
  if (!value || scheme.toLowerCase() !== 'token') {
    return null;
  }
  return value.trim() || null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly prisma: PrismaService) {
    const options: StrategyOptionsWithoutRequest = {
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        fromTokenScheme,
      ]),
      ignoreExpiration: false,
      secretOrKey: jwtSecret(),
      algorithms: [JWT_ALGORITHM],
    };
    super(options);
  }

  /** Re-reads the user so a renamed/deleted account cannot ride an old token. */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        username: true,
        bio: true,
        image: true,
        role: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException('Token subject no longer exists');
    }
    return user;
  }
}
