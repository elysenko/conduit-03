import { Profile } from './models';

/**
 * Avatar placeholder generator, matching the one the approved design uses.
 * `User.image` and `Profile.image` are nullable server-side, but every template
 * binds `[src]` unconditionally — an unresolved binding renders a broken-image
 * icon and visibly breaks the approved layout. Normalising here keeps the
 * avatar slot filled without touching a single template.
 */
const AVATAR_BASE = 'https://api.dicebear.com/7.x/initials/svg';

/** Same palette the mockup drew from, picked deterministically per handle. */
const BACKGROUNDS = ['5cb85c', '4a8fd4', 'd9822b', 'b85c5c', '7b68a6', '3f8f8a'];

function backgroundFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return BACKGROUNDS[hash % BACKGROUNDS.length];
}

/** A stable avatar URL for a handle. */
export function avatarFor(seed: string): string {
  const handle = seed.trim() || 'reader';
  return `${AVATAR_BASE}?seed=${encodeURIComponent(handle)}&backgroundColor=${backgroundFor(handle)}`;
}

/** Fill an empty avatar without overwriting one the user actually set. */
export function resolveImage(image: string | null | undefined, seed: string): string {
  return image?.trim() ? image : avatarFor(seed);
}

/** Normalise a profile straight off the wire. */
export function withAvatar(profile: Profile): Profile {
  return { ...profile, image: resolveImage(profile.image, profile.username) };
}
