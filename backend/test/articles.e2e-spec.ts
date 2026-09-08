import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  cleanupUsers,
  createApp,
  createArticle,
  http,
  newTag,
  registerUser,
  TestUser,
  uniq,
} from './helpers';

/** Article ownership enforcement and list filtering. */
describe('Conduit e2e — articles', () => {
  let app: INestApplication;
  const createdUserIds: string[] = [];
  let author: TestUser;
  let stranger: TestUser;
  /** Tag rows survive user deletion, so they are cleaned up explicitly. */
  const createdTags: string[] = [];

  beforeAll(async () => {
    app = await createApp();
    author = await registerUser(app, createdUserIds);
    stranger = await registerUser(app, createdUserIds);
  });

  afterAll(async () => {
    await cleanupUsers(app, createdUserIds);
    if (createdTags.length > 0) {
      await app
        .get(PrismaService)
        .tag.deleteMany({ where: { name: { in: createdTags } } });
    }
    await app.close();
  });

  describe('ownership: a non-author cannot mutate an article', () => {
    it('PUT by another user → 403 and the article is unchanged', async () => {
      const article = await createArticle(app, author.token);

      await http(app)
        .put(`/api/articles/${article.slug}`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .send({ article: { title: `Hijacked ${uniq()}`, description: 'nope', body: 'nope' } })
        .expect(403);

      const after = await http(app).get(`/api/articles/${article.slug}`).expect(200);
      expect(after.body.article.title).toBe(article.title);
      expect(after.body.article.description).toBe(article.description);
      expect(after.body.article.body).toBe(article.body);
      expect(after.body.article.slug).toBe(article.slug);
    });

    it('DELETE by another user → 403 and the article still exists', async () => {
      const article = await createArticle(app, author.token);

      await http(app)
        .delete(`/api/articles/${article.slug}`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .expect(403);

      await http(app).get(`/api/articles/${article.slug}`).expect(200);
    });

    it('the author can update and delete their own article', async () => {
      const article = await createArticle(app, author.token);
      const description = `updated ${uniq()}`;

      const updated = await http(app)
        .put(`/api/articles/${article.slug}`)
        .set('Authorization', `Bearer ${author.token}`)
        .send({ article: { description } })
        .expect(200);
      // Title untouched, so the slug must not be regenerated.
      expect(updated.body.article.slug).toBe(article.slug);
      expect(updated.body.article.description).toBe(description);

      await http(app)
        .delete(`/api/articles/${article.slug}`)
        .set('Authorization', `Bearer ${author.token}`)
        .expect(200);
      await http(app).get(`/api/articles/${article.slug}`).expect(404);
    });

    it('a nonexistent slug is 404 before any ownership check', async () => {
      await http(app)
        .put(`/api/articles/does-not-exist-${uniq()}`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .send({ article: { description: 'x' } })
        .expect(404);
      await http(app)
        .delete(`/api/articles/does-not-exist-${uniq()}`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .expect(404);
    });
  });

  describe('GET /api/articles?tag=', () => {
    const tagA = newTag();
    const tagB = newTag();
    const tagOther = newTag();
    createdTags.push(tagA, tagB, tagOther);
    let bothTags: any;
    let oneTag: any;
    let unrelated: any;

    beforeAll(async () => {
      // Carries two of the run's tags — the duplicate-row guard.
      bothTags = await createArticle(app, author.token, { tagList: [tagA, tagB] });
      oneTag = await createArticle(app, author.token, { tagList: [tagA] });
      unrelated = await createArticle(app, author.token, { tagList: [tagOther] });
    });

    it('returns only articles carrying the tag, each exactly once', async () => {
      const res = await http(app).get(`/api/articles?tag=${tagA}`).expect(200);

      const slugs: string[] = res.body.articles.map((a: any) => a.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
      expect(slugs.sort()).toEqual([bothTags.slug, oneTag.slug].sort());
      expect(slugs).not.toContain(unrelated.slug);
      expect(res.body.articlesCount).toBe(2);
      for (const article of res.body.articles) {
        expect(article.tagList).toContain(tagA);
      }
    });

    it('the two-tag article appears once under either of its tags', async () => {
      const res = await http(app).get(`/api/articles?tag=${tagB}`).expect(200);
      const slugs: string[] = res.body.articles.map((a: any) => a.slug);
      expect(slugs).toEqual([bothTags.slug]);
      expect(res.body.articlesCount).toBe(1);
      expect(res.body.articles[0].tagList.sort()).toEqual([tagA, tagB].sort());
    });

    it('an unmatched tag returns an empty page with 200', async () => {
      const missing = newTag();
      createdTags.push(missing);
      const res = await http(app).get(`/api/articles?tag=${missing}`).expect(200);
      expect(res.body).toEqual({ articles: [], articlesCount: 0 });
    });

    it('?author= filters to that author only', async () => {
      const res = await http(app)
        .get(`/api/articles?author=${author.username}`)
        .expect(200);
      expect(res.body.articles.length).toBeGreaterThan(0);
      for (const article of res.body.articles) {
        expect(article.author.username).toBe(author.username);
      }
    });
  });
});
