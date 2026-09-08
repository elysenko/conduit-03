# Architecture

## Requested stack
`enterprise` — Angular 19 + NestJS + tRPC + Prisma + PostgreSQL.

## Scaffolding status
The project directory was empty (only a stub `README.md`, `.git`, `.github`) before this run.
The entire `enterprise` template was newly scaffolded — no pre-existing platform code was found.

## Layout
- `frontend/` — Angular 19 standalone app (project name `frontend` in `angular.json`). Home
  route (`app-home`) calls the `users.findAll` tRPC query via `ngx-trpc` client wired in
  `app.config.ts`.
- `backend/` — NestJS app exposing a tRPC router (`nestjs-trpc`) at `/trpc`, a `UsersRouter`
  (`findAll`, `findById`), Prisma-backed `UsersService`, and a Terminus health check at
  `/health`.
- `.pipeline/surface.json` — generated manifest of routes, components, and `data-testid`
  values; the authoritative contract for downstream build/test agents.
- `.colossus-acceptance.json` — acceptance contract read by the post-deploy render gate to
  confirm the app is a real, hydrated build rather than the untouched stub shell.
- `colossus.yaml` — build manifest read by deploy agents (Angular frontend on port 80 with
  SPA fallback nginx, NestJS backend on port 3001).

## Plan alignment
The plan describes a RealWorld-style Conduit app (JWT auth, articles, comments, favorites,
follows) on a NestJS + Prisma/Postgres + Angular stack. That matches this platform's fixed
`enterprise` stack, so no stack substitution was needed. The template ships a minimal
`users` vertical slice (tRPC router/service, one Angular page) as a starting skeleton —
the coder agent builds out the plan's auth/articles/comments/profiles/tags features on top
of this scaffold, following the `.pipeline/surface.json` contract (max 400 lines per file).

## Next steps for the developer / build agent
1. `cd backend && npm install` then configure `DATABASE_URL` (Prisma/Postgres) — no
   `.env.template` ships with this template revision, so create `backend/.env` manually
   with `DATABASE_URL`, `JWT_SECRET`, `PORT`.
2. `npx prisma migrate dev` once the Conduit schema (User/Article/Comment/Tag/Favorite/
   Follow) replaces the template's minimal User model.
3. `cd frontend && npm install` — keep `frontend/package.json` deps verbatim unless a new
   dependency is genuinely required by the plan (the Dockerfile relies on a prebaked
   `node_modules` seed matching this exact dep set).
4. Extend `.pipeline/surface.json` as new routes/components/test IDs are added.
5. Fill in `expect_text` in `.colossus-acceptance.json` once the real Conduit front page
   (banner, feed tabs, popular tags) is built, replacing the template's default markers.
6. `docker compose up` for local dev once `docker-compose.yml`, Dockerfiles, and k8s
   manifests described in the plan are added.

## Template source
`template-enterprise` from `/app/scaffold-templates`.
