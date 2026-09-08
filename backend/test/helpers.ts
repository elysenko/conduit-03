import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Short random token used to keep every identifier created by this suite
 * unique. The suite runs against a shared, persistent database, so nothing
 * here may ever be a hard-coded literal.
 */
export const uniq = (): string => randomUUID().slice(0, 8);

export const newEmail = (): string => `u${uniq()}@conduit.test`;
export const newUsername = (): string => `u${uniq()}`;
/** 8..128 chars per RegisterDto; derived from a UUID, never a literal. */
export const newPassword = (): string => `Pw${randomUUID()}`;
export const newTag = (): string => `tag${uniq()}`;
export const newTitle = (): string => `Title ${uniq()}`;

export interface TestUser {
  id: string;
  email: string;
  username: string;
  password: string;
  token: string;
}

/**
 * Boots the real AppModule with the exact global prefix + ValidationPipe
 * configuration from src/main.ts. Without both, every route 404s or every
 * DTO-validated body behaves differently from production.
 */
export async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();
  return app;
}

export function http(app: INestApplication): TestAgent {
  return request(app.getHttpServer() as never);
}

/** Registers a brand-new user and returns its credentials + fresh token. */
export async function registerUser(
  app: INestApplication,
  createdUserIds: string[],
): Promise<TestUser> {
  const email = newEmail();
  const username = newUsername();
  const password = newPassword();

  const res = await http(app)
    .post('/api/users')
    .send({ user: { email, username, password } })
    .expect(201);

  const user = res.body.user;
  createdUserIds.push(user.id);
  return { id: user.id, email, username, password, token: user.token };
}

export async function createArticle(
  app: INestApplication,
  token: string,
  article: {
    title?: string;
    description?: string;
    body?: string;
    tagList?: string[];
  } = {},
): Promise<any> {
  const res = await http(app)
    .post('/api/articles')
    .set('Authorization', `Bearer ${token}`)
    .send({
      article: {
        title: article.title ?? newTitle(),
        description: article.description ?? `desc ${uniq()}`,
        body: article.body ?? `body ${uniq()}`,
        ...(article.tagList ? { tagList: article.tagList } : {}),
      },
    })
    .expect(201);
  return res.body.article;
}

/**
 * Removes every user this spec created. User deletes cascade to their
 * articles, comments, favorites and follows, so nothing else needs cleaning.
 */
export async function cleanupUsers(
  app: INestApplication,
  createdUserIds: string[],
): Promise<void> {
  if (createdUserIds.length === 0) {
    return;
  }
  const prisma = app.get(PrismaService);
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  createdUserIds.length = 0;
}
