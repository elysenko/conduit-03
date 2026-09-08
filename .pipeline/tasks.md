# Pipeline Task Decomposition

## Summary
Conduit is a RealWorld-style social publishing app built on the existing Enterprise scaffold (Angular 19 SPA + NestJS + Prisma/Postgres). Authenticated users register, log in, publish and edit markdown-ish articles with tags, comment on articles, favorite articles, and follow other authors; anonymous visitors get full public read access to the global feed, article pages, profiles and the popular-tags sidebar. Auth is JWT (HS256, 7-day expiry) stored in `localStorage` and sent as `Authorization: Bearer <jwt>` (the backend also accepts the legacy `Token <jwt>` prefix). Role model is `full_auth`: the platform-minted ADMIN account always exists and can log in, and an `/admin` route group with an `/admin/settings` page exposes credential configuration for the provisioned backing services (postgresql, minio). Everything ships containerized: nginx serves the Angular bundle and reverse-proxies `/api` to the NestJS service, with Postgres, backend, and frontend as separate Kubernetes services.

## Surface contract

### REST API (global prefix `api`, served by NestJS)
| Method | Path | Auth |
| --- | --- | --- |
| GET | `/api/health` | public |
| GET | `/api/health/deep` | public (`SELECT 1`, 503 on failure) |
| POST | `/api/users` | public (register) |
| POST | `/api/users/login` | public |
| GET | `/api/user` | guarded |
| PUT | `/api/user` | guarded |
| GET | `/api/profiles/:username` | optional auth |
| POST | `/api/profiles/:username/follow` | guarded |
| DELETE | `/api/profiles/:username/follow` | guarded |
| GET | `/api/articles` | optional auth (`tag`, `author`, `favorited`, `limit=20`, `offset=0`) |
| GET | `/api/articles/feed` | guarded |
| GET | `/api/articles/:slug` | optional auth |
| POST | `/api/articles` | guarded |
| PUT | `/api/articles/:slug` | guarded, 403 unless author |
| DELETE | `/api/articles/:slug` | guarded, 403 unless author |
| POST | `/api/articles/:slug/favorite` | guarded |
| DELETE | `/api/articles/:slug/favorite` | guarded |
| GET | `/api/articles/:slug/comments` | optional auth |
| POST | `/api/articles/:slug/comments` | guarded |
| DELETE | `/api/articles/:slug/comments/:id` | guarded, 403 unless comment author |
| GET | `/api/tags` | public (top 20 by usage desc) |
| GET | `/api/admin/settings` | guarded, ADMIN role |
| PATCH | `/api/admin/settings` | guarded, ADMIN role |

### Angular routes (`frontend/src/app/app.routes.ts`)
- `''` → HomeComponent — `?tab=global|feed&tag=<name>&page=<n>` (all state in query params)
- `'login'`, `'register'` — public
- `'article/:slug'` — public, `?modal=delete-article|delete-comment&commentId=<id>`
- `'profile/:username'` — public, children `''` (My Articles) and `'favorites'` (Favorited Articles)
- `'editor'`, `'editor/:slug'`, `'settings'` — guarded by `authGuard` (redirect `/login?redirect=<url>`)
- `'admin/settings'` — guarded by `authGuard` + ADMIN role check

### Entities
`User` (username, email, passwordHash, bio, image, role), `Article` (slug, title, description, body, authorId), `Comment` (body, articleId, authorId), `Tag` (name), `ArticleTag` (composite PK), `Favorite` (`[userId, articleId]`), `Follow` (`[followerId, followedId]`), `SystemSetting` (key/value), plus the pre-existing `ColossusAccount`.

### Required render markers (from the spec's testing strategy)
`Conduit` (brand/banner), `Global Feed` (tab label), `Popular Tags` (`<h3>` sidebar), `How to train your dragon` (seeded article).

## db_agent tasks
- [ ] Extend `backend/prisma/schema.prisma` `User` model with RealWorld fields: `username String @unique`, `bio String @default("")`, `image String?`, keep existing `email @unique`, `passwordHash`, `role Role @default(USER)`, timestamps. Keep the existing `Role` enum (`USER`, `MANAGER`, `ADMIN`) — do not rename or drop it, and do not drop `ColossusAccount`.
- [ ] Add `Article` model to `schema.prisma`: `id`, `slug String @unique`, `title`, `description`, `body`, `authorId` FK → `User` with `onDelete: Cascade`, `createdAt`, `updatedAt`; index on `authorId` and `createdAt`.
- [ ] Add `Comment` model: `id`, `body`, `articleId` FK → `Article` cascade, `authorId` FK → `User`, `createdAt`, `updatedAt`.
- [ ] Add `Tag` (`id`, `name String @unique`) and `ArticleTag` (`articleId`, `tagId`, composite `@@id([articleId, tagId])`, both relations cascade) models.
- [ ] Add `Favorite` (`@@id([userId, articleId])`, both FKs cascade) and `Follow` (`@@id([followerId, followedId])` with named self-relations `following`/`followers` on `User`) models.
- [ ] Add `SystemSetting` model: `key String @id`, `value String`, `updatedAt DateTime @updatedAt` — backs admin-configurable credentials for `postgresql` and `minio`.
- [ ] Generate the migration for all of the above (`npx prisma migrate dev --name conduit_core`) and verify `npx prisma generate` + `npx tsc --noEmit` pass in `backend/`.
- [ ] Update `backend/prisma/seed/seed.js` to keep materializing `ColossusAccount` + matching `User` rows from `COLOSSUS_ACCOUNTS_JSON` (ADMIN always present), assigning each account's `role` and a derived unique `username`. All writes must be `upsert`/`skipDuplicates` so re-running on every container start is safe.
- [ ] Extend the seed with Conduit demo content, all idempotent upserts: user `jake` (`jake@demo`, bcryptjs cost 10 hash of `Demo1234!`, bio `"I work at statefarm"`, role `USER`); article `"How to train your dragon"` (slug `how-to-train-your-dragon`, description `"Ever wonder how?"`, body text) tagged `dragons` + `training`; one comment on it; plus 2–3 extra untagged articles so tag filtering is visibly exercised.

## backend_agent tasks
- [ ] Update `backend/src/main.ts`: global prefix `api`, global `ValidationPipe` (`whitelist`, `transform`), CORS enabled, listen on `process.env.PORT ?? 3000`; register new feature modules in `backend/src/app.module.ts`.
- [ ] Add `GET /api/health/deep` to `backend/src/health/health.controller.ts` running `$queryRaw\`SELECT 1\`` via `PrismaService`, returning `{status:'ok'}` on success and 503 on failure; keep `GET /api/health` returning `{status:'ok'}`.
- [ ] Build `backend/src/auth/` core: `auth.module.ts` (registers `JwtModule` HS256, 7-day expiry, secret from `JWT_SECRET`), `jwt.strategy.ts` (extractor accepts both `Authorization: Token <jwt>` and `Bearer <jwt>`, payload `{sub, username, role}`), `jwt-auth.guard.ts` (401 when token absent/invalid), `optional-jwt-auth.guard.ts` (attaches user when present, never throws), `current-user.decorator.ts`.
- [ ] Implement `auth.service.ts` + `auth.controller.ts`: `POST /api/users` (register — min 8-char password, bcryptjs cost 10, unique email/username → 409 on conflict), `POST /api/users/login` (401 on mismatch), `GET /api/user` and `PUT /api/user` (guarded); all return `{user:{email,token,username,bio,image}}`. DTOs: `dto/register.dto.ts`, `dto/login.dto.ts`, `dto/update-user.dto.ts` with class-validator rules.
- [ ] Add `backend/src/auth/roles.guard.ts` (+ `@Roles()` decorator) enforcing `Role.ADMIN` on the `/api/admin` route group; the platform-minted ADMIN account must always be able to log in through `POST /api/users/login`.
- [ ] Create `backend/src/common/slug.util.ts` exporting `slugify(title)` = `slugify(title,{lower:true,strict:true}) + '-' + <6-char base36 suffix>`, with a uniqueness retry against the `slug` unique index.
- [ ] Create `backend/src/articles/article.view.ts` shaping `{slug,title,description,body,tagList,createdAt,updatedAt,favorited,favoritesCount,author:{username,bio,image,following}}`, resolving `favorited`/`following` from the optional current user.
- [ ] Implement `articles.service.ts` read paths + `dto/list-articles.query.ts`: `GET /api/articles` (optional auth; filters `tag`, `author`, `favorited`; `limit=20`/`offset=0`; `createdAt desc`; filter tags via a relation `some` clause so multi-tag articles are never duplicated; response `{articles, articlesCount}`), `GET /api/articles/feed` (guarded, authors the user follows), `GET /api/articles/:slug` (optional auth, 404 if missing).
- [ ] Implement `articles.service.ts` write paths + `dto/create-article.dto.ts`, `dto/update-article.dto.ts`: `POST /api/articles` (guarded — generate slug, upsert tags, link `ArticleTag`), `PUT`/`DELETE /api/articles/:slug` (guarded — look up article first, 404 when missing, then `ForbiddenException` 403 when `article.authorId !== user.id`, checked before any mutation; regenerate slug only when the title changes).
- [ ] Implement favorites in `articles.controller.ts`/`articles.service.ts`: `POST`/`DELETE /api/articles/:slug/favorite` (guarded, idempotent create/delete of `Favorite`, returns the updated article view with recomputed `favoritesCount`).
- [ ] Build `backend/src/comments/`: `GET /api/articles/:slug/comments` (optional auth), `POST` (guarded, `dto/create-comment.dto.ts`), `DELETE /api/articles/:slug/comments/:id` (guarded, 404 unknown comment, 403 unless comment author). Responses include `{id, body, createdAt, author:{username,bio,image,following}}`.
- [ ] Build `backend/src/profiles/`: `GET /api/profiles/:username` (optional auth, includes `following`), `POST`/`DELETE /api/profiles/:username/follow` (guarded, 404 on unknown user, reject self-follow with 422/400).
- [ ] Build `backend/src/tags/`: `GET /api/tags` returning `{tags:[...]}` ordered by `ArticleTag` usage count desc, limit 20.
- [ ] Create `backend/src/lib/config.ts` exporting `resolveConfig(key: string): Promise<string | null>` — reads `process.env[key]` first; when the value is absent or equals `PLACEHOLDER_CONFIGURE_IN_SETTINGS`, falls back to the `SystemSetting` row for that key; returns `null` if neither is set. Also export `ServiceUnconfiguredError` mapped to HTTP 503.
- [ ] Build `backend/src/admin/settings.controller.ts` + service: `GET /api/admin/settings` (ADMIN only — lists the keys for `postgresql` (`DATABASE_URL`) and `minio` (`MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`) with masked values and a `configured` boolean per service) and `PATCH /api/admin/settings` (ADMIN only — upserts `SystemSetting` key/value pairs, never echoes raw secrets back).
- [ ] Update `backend/Dockerfile` (multi-stage build → `node:20-alpine` runtime, copies `prisma/` + `dist/`) and add `backend/docker-entrypoint.sh` running `npx prisma migrate deploy && node dist/prisma/seed/seed.js && node dist/src/main.js`; wire it as the image `CMD`.
- [ ] Update root `docker-compose.yml` (postgres:16 with volume, backend with `DATABASE_URL=postgresql://conduit:conduit@db:5432/conduit` + `JWT_SECRET`, frontend `4200→80`), add `.env.example` (`DATABASE_URL`, `JWT_SECRET`, `PORT`, MinIO keys), and refresh `.gitignore`/`.dockerignore`.
- [ ] Create `k8s/postgres.yaml` (StatefulSet + Service + PVC), `k8s/backend.yaml` (Deployment `conduit-backend` port 3000, `replicas: 1`, liveness `/api/health`, readiness `/api/health/deep`, `DATABASE_URL`/`JWT_SECRET` from a Secret), `k8s/frontend.yaml` (Deployment `conduit-frontend` port 80 + Service), `k8s/ingress.yaml` (`/` → frontend).
- [ ] Rewrite `README.md` with setup, required env vars, `docker compose up` local-dev flow, seeded demo credentials, and the admin-settings note for `postgresql`/`minio`.

## ui_agent tasks
- [ ] Update `frontend/src/index.html` (`<title>Conduit</title>`, `<app-root>Conduit</app-root>`) and `frontend/src/styles.css` with RealWorld-like layout/typography (banner, feed toggle, article preview, sidebar tag pills).
- [ ] Rewrite `frontend/src/app/app.routes.ts` with the route table from the Surface contract (including `profile/:username` children `''` and `'favorites'`, and guarded `editor`, `editor/:slug`, `settings`, `admin/settings`), and update `app.config.ts` for `provideRouter` + `provideHttpClient(withInterceptors([authInterceptor]))`.
- [ ] Build `frontend/src/app/layout/header.component.ts` — brand "Conduit" always visible; Home / Sign in / Sign up when anonymous; Home / New Article / Settings / `username` when authenticated; an Admin link shown only when the current user's role is `ADMIN`. Build `layout/footer.component.ts`.
- [ ] Build `frontend/src/app/shared/` presentational components: `article-preview.component.ts` (author, avatar, date, title, description, favorite-count button), `article-list.component.ts` (list + pagination + empty/loading/error states), `tag-list.component.ts`, `comment-card.component.ts` (author, timestamp, delete icon for own comments), `confirm-modal.component.ts`.
- [ ] Build `frontend/src/app/pages/home/` — banner with "Conduit" + tagline; feed tabs "Your Feed" (authenticated only) and "Global Feed" (exact literal); a `#tag` tab when `?tag=` is set; sidebar `<h3>Popular Tags</h3>` rendering the tags list; all tab/tag/page state read from and written to query params.
- [ ] Build `frontend/src/app/pages/login/` and `pages/register/` — reactive forms, inline field + server error lists, honor `?redirect=` after success.
- [ ] Build `frontend/src/app/pages/article/` — title banner, author + follow button, favorite button, rendered body, tag list; comment form when authenticated vs "Sign in to add comments" link when anonymous; Edit/Delete controls only when `author.username === currentUser.username`; delete opens `?modal=delete-article`, comment delete opens `?modal=delete-comment&commentId=<id>`.
- [ ] Build `frontend/src/app/pages/editor/` — reactive form (title, description, body, tag input), create vs update driven by `:slug`, navigates to `/article/:slug` using the slug returned by the save response (handles slug change on title edit).
- [ ] Build `frontend/src/app/pages/profile/` — username, bio, image, Follow button (or "Edit profile settings" for self), child tabs "My Articles" / "Favorited Articles" rendering `article-list`.
- [ ] Build `frontend/src/app/pages/settings/` — bio / image / email / username / password form plus an "Or click here to logout" action.
- [ ] Build `frontend/src/app/pages/admin/settings/` at `/admin/settings` — one card per provisioned service (`postgresql`, `minio`) with a configured/unconfigured badge and a credential form per service (`DATABASE_URL`; `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`), masked existing values, save via PATCH, success/error feedback.
- [ ] Ensure every page has explicit loading, empty, and error states and `data-testid` hooks consistent with `.pipeline/surface.json`; keep each component file under the 400-line budget (500 hard limit).
- [ ] Update `frontend/Dockerfile` and `frontend/nginx.conf` — copy the Angular build output (verify the actual `dist/<project>/browser` path emitted by this Angular version) into `/usr/share/nginx/html`, SPA fallback `try_files $uri $uri/ /index.html`, and `location /api/ { proxy_pass http://conduit-backend:3000; }`.

## service_agent tasks
- [ ] Create `frontend/src/app/core/models.ts` — `User`, `Profile`, `Article`, `Comment`, `ArticleListResponse {articles, articlesCount}`, `SettingsResponse`, and query-param types, matching the backend response shapes exactly.
- [ ] Create `frontend/src/app/core/api.service.ts` — thin typed `HttpClient` wrapper over the same-origin `/api` base with `get/post/put/patch/delete` helpers and normalized error mapping (401 / 403 / 404 / 422 / 503).
- [ ] Create `frontend/src/app/core/auth.service.ts` — `currentUser` signal hydrated from `localStorage` on boot, `register`, `login`, `logout`, `updateUser`, token persistence, and an `isAdmin` computed from the user's role.
- [ ] Create `frontend/src/app/core/auth.interceptor.ts` (attaches `Authorization: Bearer <jwt>` when a token exists, clears session on 401) and `core/auth.guard.ts` (redirects to `/login?redirect=<url>`), plus an admin-role guard for `/admin/settings`.
- [ ] Create `frontend/src/app/core/article.service.ts` — `list(params)`, `feed(params)`, `get(slug)`, `create`, `update`, `delete`, `favorite(slug)`, `unfavorite(slug)`, `comments(slug)`, `addComment`, `deleteComment`.
- [ ] Create `frontend/src/app/core/profile.service.ts` (`get(username)`, `follow`, `unfollow`) and `core/tag.service.ts` (`list()` → `{tags}`).
- [ ] Create `frontend/src/app/core/admin-settings.service.ts` — `getSettings()` and `updateSettings(payload)` against `/api/admin/settings`.
- [ ] Wire the pages to the services: replace the scaffold's tRPC/user demo calls in `frontend/src/app/home/` and `app.component.ts` with the Conduit shell + services, and remove the now-unused `trpc-client.types.ts` demo plumbing.

## tester tasks
- [ ] Add `backend/test/jest-e2e.json` and the `test:e2e` script, bootstrapping the Nest app against a throwaway Postgres with migrations + seed applied.
- [ ] `backend/test/conduit.e2e-spec.ts`: login as `jake@demo` / `Demo1234!` returns 200 with a token; register creates a user and returns a token; duplicate email/username rejected.
- [ ] E2E: unauthenticated `POST /api/articles`, `POST /api/articles/:slug/comments`, `POST /api/articles/:slug/favorite`, `POST /api/profiles/:username/follow` each return **401**.
- [ ] E2E: a second registered user editing or deleting jake's article returns **403** and the article is unchanged afterwards; a missing slug returns **404** (asserts existence-before-ownership ordering).
- [ ] E2E: `GET /api/articles?tag=dragons` returns only the tagged article, with no duplicates for multi-tag articles, and `articlesCount` matching.
- [ ] E2E: favoriting increments `favoritesCount` and the article appears under `GET /api/articles?favorited=<username>`; unfavoriting reverses both.
- [ ] E2E: following jake makes his articles appear in `GET /api/articles/feed`; unfollowing empties it.
- [ ] E2E: create then delete a comment (author 200; non-author 403), and `GET /api/health/deep` returns 200 once migrations have run.
- [ ] E2E: `GET`/`PATCH /api/admin/settings` return 403 for a non-admin user, 200 for the ADMIN account, and PATCH persists a `SystemSetting` value that `resolveConfig` then returns.
- [ ] Smoke check: `docker compose up` then assert the four render markers appear on `http://localhost:4200` — "Conduit", "Global Feed", "How to train your dragon", "Popular Tags".

## Open questions
- **tRPC vs REST.** The scaffold ships a tRPC glue layer (`backend/src/trpc/*`, `frontend/src/app/trpc-client.types.ts`, `glue.api_client: "trpc"` in `colossus.stack.json`), but the spec defines a plain REST surface under `/api`. These tasks follow the spec (REST controllers + an Angular `HttpClient` data layer); confirm the leftover tRPC demo modules should be deleted rather than kept alongside.
- **MinIO.** `postgresql` and `minio` are provisioned deployments, but the spec never describes object storage (article/profile images are plain URL strings). MinIO is therefore only surfaced as configurable credentials in `/admin/settings`; confirm whether image upload is actually in scope.
- **Roles.** The spec explicitly models "no role column" ("first registered user is admin"), while the platform auth model is `full_auth` and the existing schema already has `Role { USER, MANAGER, ADMIN }` plus platform-minted accounts. These tasks keep the existing enum and rely on the minted ADMIN account rather than promoting the first registrant; confirm no MANAGER-specific behaviour is expected.
- **Angular version.** The spec assumes Angular 17 standalone; the scaffold is Angular 19. Standalone APIs are compatible, but the production build output path (`dist/<project>/browser`) must be verified against the actual `angular.json` before the nginx `COPY` line is trusted.
- **Docker target paths.** `colossus.stack.json` declares a frontend docker target at `web/Dockerfile.frontend`, while the scaffold has `frontend/Dockerfile`. Confirm which the deploy pipeline uses.
- **JWT secret in k8s.** The spec notes the `JWT_SECRET` Secret must be provisioned by the deploy pipeline; the backend should fail fast rather than boot with an insecure default — confirm fail-fast is acceptable in this environment.
