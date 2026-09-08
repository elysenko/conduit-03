import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isUnconfigured, resolveConfig } from '../lib/config';
import { KNOWN_KEYS, SERVICE_CATALOG } from './settings.catalog';

/** Placeholder returned instead of a stored secret; never echo raw secrets. */
export const MASK = '••••••••';

export interface SettingFieldView {
  key: string;
  label: string;
  value: string;
  placeholder: string;
  secret: boolean;
}

export interface ServiceSettingView {
  service: string;
  label: string;
  description: string;
  configured: boolean;
  fields: SettingFieldView[];
}

/** A masked value round-tripped by the UI means "leave this one alone". */
function isMasked(value: string): boolean {
  return value.includes('•');
}

/** Keep a connection string readable while hiding the password. */
function maskUrl(value: string): string {
  return value.replace(/(:\/\/[^:/@]+:)[^@]+@/, `$1${MASK}@`);
}

function maskValue(value: string, secret: boolean): string {
  if (!secret) {
    return value;
  }
  return value.includes('://') && value.includes('@')
    ? maskUrl(value)
    : MASK;
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** One card per provisioned service, with masked values and a configured flag. */
  async list(): Promise<ServiceSettingView[]> {
    const resolved = new Map<string, string | null>();
    await Promise.all(
      KNOWN_KEYS.map(async (key) => {
        resolved.set(key, await resolveConfig(this.prisma, key));
      }),
    );

    return SERVICE_CATALOG.map((service) => {
      const fields = service.fields.map((field) => {
        const value = resolved.get(field.key) ?? null;
        return {
          key: field.key,
          label: field.label,
          value: value ? maskValue(value, field.secret) : '',
          placeholder: field.placeholder,
          secret: field.secret,
        };
      });
      return {
        service: service.service,
        label: service.label,
        description: service.description,
        // Configured when every field of the service has a value.
        configured: fields.every((field) => field.value !== ''),
        fields,
      };
    });
  }

  /**
   * Upsert SystemSetting rows. Unknown keys are rejected, blank and masked
   * values are ignored so a form round-trip cannot wipe or corrupt a secret.
   */
  async update(
    pairs: { key: string; value: string }[],
  ): Promise<{ updated: string[]; ignored: string[] }> {
    const unknown = pairs.filter((pair) => !KNOWN_KEYS.includes(pair.key));
    if (unknown.length) {
      throw new BadRequestException(
        `Unknown setting key(s): ${unknown.map((pair) => pair.key).join(', ')}`,
      );
    }

    const updated: string[] = [];
    const ignored: string[] = [];
    for (const { key, value } of pairs) {
      const trimmed = (value ?? '').trim();
      if (isUnconfigured(trimmed) || isMasked(trimmed)) {
        ignored.push(key);
        continue;
      }
      await this.prisma.systemSetting.upsert({
        where: { key },
        update: { value: trimmed },
        create: { key, value: trimmed },
      });
      updated.push(key);
    }
    return { updated, ignored };
  }
}
