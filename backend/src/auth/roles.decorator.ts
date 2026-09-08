import { SetMetadata } from '@nestjs/common';
import type { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** `@Roles('ADMIN')` — enforced by RolesGuard, which must run after JwtAuthGuard. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
