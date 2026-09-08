# Conduit

A RealWorld-style social publishing app: register, publish tagged articles,
comment, favorite, and follow other authors. Anonymous visitors get full public
read access to the global feed, article pages, profiles and the popular-tags
sidebar.

- **Frontend** — Angular 19 standalone SPA (`frontend/`), served by nginx.
- **Backend** — NestJS REST API under `/api` (`backend/`), Prisma + PostgreSQL.
- **Auth** — JWT (HS256, 7-day). The browser stores the token and sends
  `Authorization: Bearer <jwt>`; the API also accepts the RealWorld-style
  `Authorization: Token <jwt>`.

## Quick start (Docker)

```bash
docker compose up --build
open http://localhost:4200        # SPA (nginx proxies /api to the backend)
open http://localhost:3001/api/docs   # Swagger
```

Compose starts Postgres, runs `prisma migrate deploy` + the platform account
seed, then boots the API.

## Local development

```bash
# backend
cd backend
cp .env.example .env              # set DATABASE_URL and JWT_SECRET
npm install
npx prisma migrate deploy
npm run start:dev                 # http://localhost:3001/api

# frontend (separate shell)
cd frontend
npm install
npx ng serve                      # http://localhost:4200, /api proxied to :3001
```

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string (platform-provisioned). |
| `JWT_SECRET` | yes | HS256 signing secret (platform-provisioned). |
| `PORT` | no | API port, default `3001` (matches `colossus.yaml`). |
| `JWT_EXPIRES_IN` | no | Token lifetime, default `7d`. Accepts `900`, `12h`, `1d`. |
| `COLOSSUS_ACCOUNTS_JSON` | seed only | Platform-minted logins materialized by `prisma/seed/seed.js`. |
| `MINIO_*` | no | Optional object storage; missing values degrade the feature (503), never crash the app. |

Optional credentials can also be set at runtime by an ADMIN at
**/admin/settings**, which writes `SystemSetting` rows. Resolution order is
environment variable → `SystemSetting` row → unconfigured.

## Accounts

Logins are platform-owned: `prisma/seed/seed.js` materializes one
`colossus_accounts` row and one matching `User` (bcrypt hash) per entry in
`COLOSSUS_ACCOUNTS_JSON`. The seed ships no demo content — screens render their
empty state on a fresh database until users sign up and publish.

## API

Global prefix `/api`. Swagger UI at `/api/docs`.

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/api/health` | public (liveness) |
| GET | `/api/health/deep` | public (readiness, `SELECT 1`, 503 on failure) |
| POST | `/api/users` | public — register, `{user:{username,email,password}}` |
| POST | `/api/users/login` | public — `{user:{email,password}}` |
| GET / PUT | `/api/user` | JWT |
| GET | `/api/profiles/:username` | optional JWT |
| POST / DELETE | `/api/profiles/:username/follow` | JWT |
| GET | `/api/articles` | optional JWT — `tag`, `author`, `favorited`, `limit=20`, `offset=0` |
| GET | `/api/articles/feed` | JWT — articles by followed authors |
| GET | `/api/articles/:slug` | optional JWT |
| POST | `/api/articles` | JWT — `{article:{title,description,body,tagList}}` |
| PUT / DELETE | `/api/articles/:slug` | JWT — 404 unknown slug, 403 unless author |
| POST / DELETE | `/api/articles/:slug/favorite` | JWT — idempotent |
| GET | `/api/articles/:slug/comments` | optional JWT |
| POST | `/api/articles/:slug/comments` | JWT — `{comment:{body}}` |
| DELETE | `/api/articles/:slug/comments/:id` | JWT — 403 unless comment author |
| GET | `/api/tags` | public — top 20 tags by usage |
| GET / PATCH | `/api/admin/settings` | JWT + `ADMIN` |

Requests and responses use the RealWorld envelopes (`{user}`, `{article}`,
`{articles, articlesCount}`, `{comment}`, `{comments}`, `{profile}`, `{tags}`).

## Tests

```bash
cd backend
npm test          # unit tests
npm run typecheck # tsc --noEmit
```

## Deployment

`colossus.yaml` is the build contract read by the deploy pipeline: the Angular
bundle (`dist/frontend/browser`) is served by nginx on port 80 with SPA
fallback, and the NestJS image runs on port 3001 with `/api/health` for
liveness and `/api/health/deep` for readiness. Migrations run via
`npx prisma migrate deploy` before the app starts.
