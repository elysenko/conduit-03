import { baseSlug, slugify, uniqueSlug } from './slug.util';

describe('baseSlug', () => {
  it('lowercases and hyphen-joins', () => {
    expect(baseSlug('How to train your dragon')).toBe('how-to-train-your-dragon');
  });

  it('strips punctuation and accents', () => {
    expect(baseSlug('Café — "Déjà vu"!')).toBe('cafe-deja-vu');
  });

  it('never returns an empty slug', () => {
    expect(baseSlug('!!!')).toBe('article');
  });

  it('never ends in a hyphen after truncation', () => {
    expect(baseSlug('a'.repeat(120))).not.toMatch(/-$/);
  });
});

describe('slugify', () => {
  it('appends a 6-char base36 suffix', () => {
    expect(slugify('How to train your dragon')).toMatch(
      /^how-to-train-your-dragon-[a-z0-9]{6}$/,
    );
  });

  it('produces different slugs for the same title', () => {
    const slugs = new Set(Array.from({ length: 20 }, () => slugify('Same title')));
    expect(slugs.size).toBeGreaterThan(1);
  });
});

describe('uniqueSlug', () => {
  it('retries until the slug is free', async () => {
    let calls = 0;
    const slug = await uniqueSlug('Taken title', async () => {
      calls += 1;
      return calls < 3; // first two candidates are taken
    });
    expect(calls).toBe(3);
    expect(slug).toMatch(/^taken-title-[a-z0-9]{6}$/);
  });

  it('falls back to a longer suffix when every attempt collides', async () => {
    const slug = await uniqueSlug('Busy', async () => true, 2);
    expect(slug).toMatch(/^busy-[a-z0-9]{12}$/);
  });
});
