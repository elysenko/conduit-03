import { HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Value written by the deploy pipeline when a credential slot exists but has
 * not been filled in. Treated exactly like "absent".
 */
export const PLACEHOLDER = 'PLACEHOLDER_CONFIGURE_IN_SETTINGS';

/**
 * Thrown when a feature needs a credential that is configured nowhere.
 * Maps to HTTP 503 so a missing third-party key degrades the feature instead of
 * crash-looping the pod (see the env-validation rule: only DATABASE_URL and
 * JWT_SECRET are app-owned and always provisioned).
 */
export class ServiceUnconfiguredError extends HttpException {
  constructor(key: string) {
    super(
      {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'Service Unavailable',
        message: `${key} is not configured. An administrator can set it in Admin → Settings.`,
        key,
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

/**
 * Platform-provided aliases for keys this app names differently.
 *
 * The infra secret publishes MinIO's credentials under the names the MinIO
 * chart uses (`MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`), while the settings
 * catalog names them by their S3 role. Without this mapping the credentials are
 * present in the environment but read as absent, and object storage shows up as
 * "Not configured" on the admin screen despite being provisioned.
 */
const ENV_ALIASES: Record<string, string[]> = {
  MINIO_ACCESS_KEY: ['MINIO_ROOT_USER'],
  MINIO_SECRET_KEY: ['MINIO_ROOT_PASSWORD'],
};

function readEnvVar(name: string): string | null {
  const value = process.env[name];
  return value && value !== PLACEHOLDER ? value : null;
}

function fromEnv(key: string): string | null {
  // The canonical name always wins; aliases only fill a gap.
  return (
    readEnvVar(key) ??
    (ENV_ALIASES[key] ?? []).reduce<string | null>(
      (found, alias) => found ?? readEnvVar(alias),
      null,
    )
  );
}

/**
 * Resolve a config value: environment variable first (mounted from the
 * platform secret at deploy time), then the `SystemSetting` row an admin can
 * edit, then null.
 */
export async function resolveConfig(
  prisma: PrismaService,
  key: string,
): Promise<string | null> {
  const env = fromEnv(key);
  if (env) {
    return env;
  }
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key } });
    return row?.value && row.value !== PLACEHOLDER ? row.value : null;
  } catch {
    // A settings-table read must never take down a request path.
    return null;
  }
}

/** Same as `resolveConfig` but throws a 503 instead of returning null. */
export async function requireConfig(
  prisma: PrismaService,
  key: string,
): Promise<string> {
  const value = await resolveConfig(prisma, key);
  if (!value) {
    throw new ServiceUnconfiguredError(key);
  }
  return value;
}

/** True when the value is missing or still the deploy-time placeholder. */
export function isUnconfigured(value: string | null | undefined): boolean {
  return !value || value === PLACEHOLDER;
}
