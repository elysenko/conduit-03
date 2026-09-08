import { Logger } from '@nestjs/common';

const logger = new Logger('AuthConfig');

export const JWT_ALGORITHM = 'HS256' as const;

const SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

/**
 * Token lifetime in seconds (a number, so it satisfies @nestjs/jwt's
 * `expiresIn` typing without the `ms` StringValue template type).
 * Accepts `JWT_EXPIRES_IN` / `JWT_EXPIRATION` / `JWT_EXP` as `900`, `1d`, `12h`.
 */
function parseExpiry(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }
  const match = /^(\d+)\s*([smhd])?$/.exec(raw.trim());
  if (!match) {
    return fallback;
  }
  const amount = Number(match[1]);
  return amount * (match[2] ? SECONDS[match[2]] : 1);
}

/** 7 days per the plan, unless the platform injects a shorter lifetime. */
export const JWT_EXPIRES_IN: number = parseExpiry(
  process.env.JWT_EXPIRES_IN ?? process.env.JWT_EXPIRATION ?? process.env.JWT_EXP,
  7 * 24 * 60 * 60,
);

let cachedSecret: string | null = null;

/**
 * JWT signing secret. `JWT_SECRET` is app-owned config the platform always
 * provisions; if it is somehow absent we log loudly and fall back to an
 * ephemeral value rather than crash-looping the pod (sessions then simply do
 * not survive a restart).
 */
export function jwtSecret(): string {
  if (cachedSecret) {
    return cachedSecret;
  }
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv.trim()) {
    cachedSecret = fromEnv;
  } else {
    logger.error(
      'JWT_SECRET is not set — falling back to an ephemeral per-process secret. ' +
        'Issued tokens will not survive a restart. Set JWT_SECRET in the app secret.',
    );
    cachedSecret = `ephemeral-${Math.random().toString(36).slice(2)}${Date.now()}`;
  }
  return cachedSecret;
}

export const BCRYPT_ROUNDS = 10;
