/**
 * Slug generation for articles.
 *
 * Implemented in-repo rather than pulling `slugify` so the backend keeps a
 * dependency set the build image can install offline, and so the CommonJS
 * interop of that package (which ships `export =` typings) cannot break
 * `nest build` under `"module": "commonjs"`.
 */

/** Lowercase, ASCII-folded, hyphen-joined form of a title. Never empty. */
export function baseSlug(title: string): string {
  const normalized = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return normalized || 'article';
}

/** 6-char base36 suffix, zero-padded so the slug shape is stable. */
export function slugSuffix(): string {
  return Math.random().toString(36).slice(2, 8).padEnd(6, '0');
}

/**
 * `slugify(title)` per the plan: base slug + '-' + 6-char base36 suffix.
 * The suffix keeps two articles with the same title from colliding on the
 * `slug` unique index; callers additionally retry via `uniqueSlug`.
 */
export function slugify(title: string): string {
  return `${baseSlug(title)}-${slugSuffix()}`;
}

/**
 * Generate a slug that is not already taken. `exists` is injected so this stays
 * pure and testable; the articles service passes a Prisma lookup.
 */
export async function uniqueSlug(
  title: string,
  exists: (slug: string) => Promise<boolean>,
  attempts = 5,
): Promise<string> {
  for (let i = 0; i < attempts; i += 1) {
    const candidate = slugify(title);
    if (!(await exists(candidate))) {
      return candidate;
    }
  }
  // Extremely unlikely: fall back to a longer suffix rather than throwing.
  return `${baseSlug(title)}-${slugSuffix()}${slugSuffix()}`;
}
