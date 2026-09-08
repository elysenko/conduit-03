import { INestApplication } from '@nestjs/common';
import {
  cleanupUsers,
  createApp,
  createArticle,
  http,
  newEmail,
  newPassword,
  newUsername,
  registerUser,
  TestUser,
} from './helpers';

/**
 * Auth, health and the unauthenticated-access (401) contract.
 * Runs against the live database, so every identity is generated at runtime.
 */
describe('Conduit e2e — auth, health, unauthenticated access', () => {
  let app: INestApplication;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await cleanupUsers(app, createdUserIds);
    await app.close();
  });

  describe('GET /api/health', () => {
    it('answers 200 without auth', async () => {
      const res = await http(app).get('/api/health').expect(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });

  describe('POST /api/users (register)', () => {
    it('returns a token and a user envelope with no password material', async () => {
      const email = newEmail();
      const username = newUsername();
      const password = newPassword();

      const res = await http(app)
        .post('/api/users')
        .send({ user: { email, username, password } })
        .expect(201);

      expect(res.body).toHaveProperty('user');
      const user = res.body.user;
      createdUserIds.push(user.id);

      expect(typeof user.token).toBe('string');
      expect(user.token.split('.')).toHaveLength(3);
      expect(user.email).toBe(email);
      expect(user.username).toBe(username);
      expect(user.bio).toBe('');
      expect(user.image).toBeNull();

      // No password material may ever leave the API.
      expect(user).not.toHaveProperty('password');
      expect(user).not.toHaveProperty('passwordHash');
      expect(JSON.stringify(res.body)).not.toContain(password);
    });

    it('rejects a duplicate email with 409', async () => {
      const existing = await registerUser(app, createdUserIds);
      await http(app)
        .post('/api/users')
        .send({
          user: {
            email: existing.email,
            username: newUsername(),
            password: newPassword(),
          },
        })
        .expect(409);
    });

    it('rejects an invalid body with 400', async () => {
      await http(app)
        .post('/api/users')
        .send({ user: { email: 'not-an-email', username: newUsername(), password: newPassword() } })
        .expect(400);

      // Too short for the 8-char minimum.
      await http(app)
        .post('/api/users')
        .send({ user: { email: newEmail(), username: newUsername(), password: 'short7c' } })
        .expect(400);
    });
  });

  describe('POST /api/users/login', () => {
    let user: TestUser;

    beforeAll(async () => {
      user = await registerUser(app, createdUserIds);
    });

    it('succeeds with the registered credentials', async () => {
      const res = await http(app)
        .post('/api/users/login')
        .send({ user: { email: user.email, password: user.password } })
        .expect(200);

      expect(res.body.user.email).toBe(user.email);
      expect(res.body.user.username).toBe(user.username);
      expect(typeof res.body.user.token).toBe('string');
      expect(res.body.user).not.toHaveProperty('passwordHash');

      // The issued token authenticates GET /api/user.
      const me = await http(app)
        .get('/api/user')
        .set('Authorization', `Bearer ${res.body.user.token}`)
        .expect(200);
      expect(me.body.user.email).toBe(user.email);
    });

    it('rejects a wrong password with 401', async () => {
      const res = await http(app)
        .post('/api/users/login')
        .send({ user: { email: user.email, password: newPassword() } })
        .expect(401);
      // The failure must not disclose whether the account exists.
      expect(JSON.stringify(res.body)).not.toContain(user.email);
    });

    it('rejects an unknown email with 401', async () => {
      await http(app)
        .post('/api/users/login')
        .send({ user: { email: newEmail(), password: newPassword() } })
        .expect(401);
    });
  });

  describe('unauthenticated writes are 401 (not 403)', () => {
    let author: TestUser;
    let slug: string;

    beforeAll(async () => {
      author = await registerUser(app, createdUserIds);
      const article = await createArticle(app, author.token);
      slug = article.slug;
    });

    it('POST /api/articles → 401', async () => {
      await http(app)
        .post('/api/articles')
        .send({ article: { title: 'x', description: 'y', body: 'z' } })
        .expect(401);
    });

    it('POST /api/articles/:slug/comments → 401', async () => {
      await http(app)
        .post(`/api/articles/${slug}/comments`)
        .send({ comment: { body: 'anonymous' } })
        .expect(401);
    });

    it('POST /api/articles/:slug/favorite → 401', async () => {
      await http(app).post(`/api/articles/${slug}/favorite`).expect(401);
    });

    it('POST /api/profiles/:username/follow → 401', async () => {
      await http(app).post(`/api/profiles/${author.username}/follow`).expect(401);
    });

    it('GET /api/user → 401 without a token and with a garbage token', async () => {
      await http(app).get('/api/user').expect(401);
      await http(app)
        .get('/api/user')
        .set('Authorization', 'Bearer not-a-real-token')
        .expect(401);
    });
  });
});
