import { INestApplication } from '@nestjs/common';
import {
  cleanupUsers,
  createApp,
  createArticle,
  http,
  registerUser,
  TestUser,
  uniq,
} from './helpers';

/** Favorites, follows/feed and comments. */
describe('Conduit e2e — favorites, follows and comments', () => {
  let app: INestApplication;
  const createdUserIds: string[] = [];
  let author: TestUser;
  let reader: TestUser;

  beforeAll(async () => {
    app = await createApp();
    author = await registerUser(app, createdUserIds);
    reader = await registerUser(app, createdUserIds);
  });

  afterAll(async () => {
    await cleanupUsers(app, createdUserIds);
    await app.close();
  });

  describe('favorites', () => {
    it('favoriting bumps favoritesCount and lists under ?favorited=', async () => {
      const article = await createArticle(app, author.token);
      expect(article.favorited).toBe(false);
      expect(article.favoritesCount).toBe(0);

      const favorited = await http(app)
        .post(`/api/articles/${article.slug}/favorite`)
        .set('Authorization', `Bearer ${reader.token}`)
        .expect(200);
      expect(favorited.body.article.favorited).toBe(true);
      expect(favorited.body.article.favoritesCount).toBe(1);

      const listed = await http(app)
        .get(`/api/articles?favorited=${reader.username}`)
        .expect(200);
      expect(listed.body.articles.map((a: any) => a.slug)).toContain(article.slug);

      // Idempotent: a second favorite must not double-count or 500.
      const again = await http(app)
        .post(`/api/articles/${article.slug}/favorite`)
        .set('Authorization', `Bearer ${reader.token}`)
        .expect(200);
      expect(again.body.article.favoritesCount).toBe(1);

      const unfavorited = await http(app)
        .delete(`/api/articles/${article.slug}/favorite`)
        .set('Authorization', `Bearer ${reader.token}`)
        .expect(200);
      expect(unfavorited.body.article.favorited).toBe(false);
      expect(unfavorited.body.article.favoritesCount).toBe(0);

      const afterList = await http(app)
        .get(`/api/articles?favorited=${reader.username}`)
        .expect(200);
      expect(afterList.body.articles.map((a: any) => a.slug)).not.toContain(
        article.slug,
      );
    });

    it('favoriting an unknown slug → 404', async () => {
      await http(app)
        .post(`/api/articles/missing-${uniq()}/favorite`)
        .set('Authorization', `Bearer ${reader.token}`)
        .expect(404);
    });
  });

  describe('follows and GET /api/articles/feed', () => {
    it('following an author surfaces their articles in the feed', async () => {
      const follower = await registerUser(app, createdUserIds);

      // Empty feed before following anyone.
      const empty = await http(app)
        .get('/api/articles/feed')
        .set('Authorization', `Bearer ${follower.token}`)
        .expect(200);
      expect(empty.body).toEqual({ articles: [], articlesCount: 0 });

      const own = await createArticle(app, follower.token);
      const theirs = await createArticle(app, author.token);

      const followed = await http(app)
        .post(`/api/profiles/${author.username}/follow`)
        .set('Authorization', `Bearer ${follower.token}`)
        .expect(200);
      expect(followed.body.profile).toEqual({
        username: author.username,
        bio: '',
        image: null,
        following: true,
      });

      const feed = await http(app)
        .get('/api/articles/feed')
        .set('Authorization', `Bearer ${follower.token}`)
        .expect(200);
      const slugs: string[] = feed.body.articles.map((a: any) => a.slug);
      expect(slugs).toContain(theirs.slug);
      // Own articles are never in one's own feed.
      expect(slugs).not.toContain(own.slug);
      for (const article of feed.body.articles) {
        expect(article.author.following).toBe(true);
      }

      // Following twice stays 200-ish and idempotent.
      await http(app)
        .post(`/api/profiles/${author.username}/follow`)
        .set('Authorization', `Bearer ${follower.token}`)
        .expect(200);

      const profile = await http(app)
        .get(`/api/profiles/${author.username}`)
        .set('Authorization', `Bearer ${follower.token}`)
        .expect(200);
      expect(profile.body.profile.following).toBe(true);
      expect(profile.body.profile).not.toHaveProperty('email');

      await http(app)
        .delete(`/api/profiles/${author.username}/follow`)
        .set('Authorization', `Bearer ${follower.token}`)
        .expect(200);

      const afterUnfollow = await http(app)
        .get('/api/articles/feed')
        .set('Authorization', `Bearer ${follower.token}`)
        .expect(200);
      expect(afterUnfollow.body).toEqual({ articles: [], articlesCount: 0 });
    });

    it('the feed route is guarded, not swallowed by GET /api/articles/:slug', async () => {
      await http(app).get('/api/articles/feed').expect(401);
    });
  });

  describe('comments', () => {
    it('creates, lists and deletes a comment', async () => {
      const article = await createArticle(app, author.token);
      const body = `Nice post ${uniq()}`;

      const created = await http(app)
        .post(`/api/articles/${article.slug}/comments`)
        .set('Authorization', `Bearer ${reader.token}`)
        .send({ comment: { body } })
        .expect(201);

      const comment = created.body.comment;
      expect(comment.body).toBe(body);
      expect(comment.author.username).toBe(reader.username);
      expect(comment.author).not.toHaveProperty('email');
      expect(typeof comment.createdAt).toBe('string');

      const listed = await http(app)
        .get(`/api/articles/${article.slug}/comments`)
        .expect(200);
      expect(listed.body.comments.map((c: any) => c.id)).toContain(comment.id);

      await http(app)
        .delete(`/api/articles/${article.slug}/comments/${comment.id}`)
        .set('Authorization', `Bearer ${reader.token}`)
        .expect(200);

      const after = await http(app)
        .get(`/api/articles/${article.slug}/comments`)
        .expect(200);
      expect(after.body.comments.map((c: any) => c.id)).not.toContain(comment.id);
    });

    it("deleting another user's comment → 403 and the comment survives", async () => {
      const article = await createArticle(app, author.token);
      const created = await http(app)
        .post(`/api/articles/${article.slug}/comments`)
        .set('Authorization', `Bearer ${reader.token}`)
        .send({ comment: { body: `mine ${uniq()}` } })
        .expect(201);
      const commentId = created.body.comment.id;

      await http(app)
        .delete(`/api/articles/${article.slug}/comments/${commentId}`)
        .set('Authorization', `Bearer ${author.token}`)
        .expect(403);

      const listed = await http(app)
        .get(`/api/articles/${article.slug}/comments`)
        .expect(200);
      expect(listed.body.comments.map((c: any) => c.id)).toContain(commentId);
    });

    it('rejects a blank comment body with 400', async () => {
      const article = await createArticle(app, author.token);
      await http(app)
        .post(`/api/articles/${article.slug}/comments`)
        .set('Authorization', `Bearer ${reader.token}`)
        .send({ comment: { body: '' } })
        .expect(400);
    });
  });
});
