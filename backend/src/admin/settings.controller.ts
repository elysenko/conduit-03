import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  SettingsService,
  type ServiceSettingView,
} from './settings.service';

/** Accepted PATCH shapes, normalized to `{ key, value }[]`. */
type PatchBody =
  | { settings?: unknown; fields?: unknown }
  | { key: string; value: string }[]
  | Record<string, unknown>;

function normalize(body: PatchBody): { key: string; value: string }[] {
  const source: unknown = Array.isArray(body)
    ? body
    : ((body as { settings?: unknown }).settings ??
      (body as { fields?: unknown }).fields ??
      body);

  if (Array.isArray(source)) {
    return source.map((entry) => {
      const item = entry as { key?: unknown; value?: unknown };
      if (typeof item?.key !== 'string') {
        throw new BadRequestException('Each setting needs a string "key"');
      }
      return { key: item.key, value: String(item.value ?? '') };
    });
  }

  if (source && typeof source === 'object') {
    return Object.entries(source as Record<string, unknown>).map(
      ([key, value]) => ({ key, value: String(value ?? '') }),
    );
  }

  throw new BadRequestException(
    'Body must be an array of { key, value } or an object map of settings',
  );
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  list(): Promise<ServiceSettingView[]> {
    return this.settings.list();
  }

  @Patch()
  async update(
    @Body() body: PatchBody,
  ): Promise<{ ok: true; updated: string[]; ignored: string[]; services: ServiceSettingView[] }> {
    const result = await this.settings.update(normalize(body));
    return { ok: true, ...result, services: await this.settings.list() };
  }
}
