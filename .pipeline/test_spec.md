# Test Specification

> **WARNING — `surface.json` is stale and does not describe this product.**
> `.pipeline/surface.json` still contains the generic scaffold surface (`GET /health`,
> `GET /trpc/users.findAll`, `GET /trpc/users.findById`, and `home-*`/`users-*` testIds).
> None of the tRPC routes are part of the Conduit spec. This test spec therefore derives the
> API surface from the approved spec + `.pipeline/tasks.md` "Surface contract" (23 REST
> endpoints under the global `api` prefix), and maps the three scaffold routes explicitly:
> - `GET /health` → covered as `GET /api/health` (global prefix `api` is mandated by the spec).
> - `GET /trpc/users.findAll`, `GET /trpc/users.findById` → **negative** coverage only; the
>   scaffold tRPC demo plumbing is to be removed (see Out of scope, OOS-1).
> Two further scaffold/spec conflicts are asserted rather than assumed:
> - `colossus.yaml` declares `backend.port: 3001`; the spec and `k8s/backend.yaml` mandate **3000**.
>   Tests pin 3000 (INFRA-4).
> - `.colossus-acceptance.json` rejects the signatures `home-title">Users<`, `Loading...`,
>   `Failed to load users.` — covered by UI-001.

## Coverage summary
- Total cases: 260 — 152 API + 85 UI/journey + 16 data integrity + 7 infrastructure
- API endpoints covered: 23 / 23 (spec + tasks.md contract); 3 / 3 stale `surface.json` routes reconciled as above
- User journeys covered: 15
- Out-of-scope items declared: 11

**Legend** — `AUTH_JAKE` = token from `jake@demo` / `Demo1234!` (seeded). `AUTH_BOB` = token for a
second user registered during the run. `AUTH_ADMIN` = token for the platform-minted ADMIN account.
`SLUG_DRAGON` = `how-to-train-your-dragon` (seeded). All request bodies are RealWorld-envelope
shaped (`{user:{...}}`, `{article:{...}}`, `{comment:{...}}`) and all responses must be envelope
shaped identically. Every authenticated request is run **twice**, once with
`Authorization: Bearer <jwt>` and once with `Authorization: Token <jwt>`, unless noted (API-011).

---

## API tests

### `GET /api/health`
- **Happy path**: API-001 — no auth, no body → `200`, body exactly `{"status":"ok"}`.
- **Validation failures**: n/a (no inputs).
- **Auth failures**: API-002 — request with a garbage `Authorization: Bearer notatoken` header still → `200` (health is unauthenticated and must not run the guard).
- **Idempotency / edge cases**: API-003 — 5 sequential calls all `200` with identical body; responds `200` even while the DB connection is down (liveness must not depend on Postgres).

### `GET /api/health/deep`
- **Happy path**: API-004 — after `prisma migrate deploy` has run → `200`, `{"status":"ok"}`; the handler must have executed `SELECT 1`.
- **Validation failures**: n/a.
- **Auth failures**: API-005 — no auth required → `200` without any `Authorization` header.
- **Idempotency / edge cases**: API-006 — with the DB stopped/unreachable (or `PrismaService.$queryRaw` stubbed to reject) → `503`, and the process does **not** crash; a subsequent call after the DB returns → `200`.

### `POST /api/users` (register)
- **Happy path**: API-007 — `{"user":{"username":"bob","email":"bob@demo","password":"Demo1234!"}}` → `201` (accept `200` if the controller does not override), body `{"user":{"email":"bob@demo","token":"<jwt>","username":"bob","bio":"","image":null}}`. `token` decodes as HS256 with payload `{sub,username,role}` and `exp - iat === 604800` (7 days). Response must **not** contain `password` or `passwordHash`.
- **Validation failures**:
  - API-008 — password `"short7c"` (7 chars) → `400`, error mentions the password field.
  - API-009 — `email: "not-an-email"` → `400`.
  - API-010 — missing `username` → `400`; missing `email` → `400`; missing `password` → `400`.
  - API-011 — extra unknown property `{"user":{...,"role":"ADMIN"}}` → stripped by the global `ValidationPipe` `whitelist`; the created user's role is `USER`, never `ADMIN` (privilege-escalation guard).
  - API-012 — empty-string `username` → `400`.
- **Auth failures**: n/a (public). API-013 — sending a valid `Authorization` header does not change the outcome (still creates a new user).
- **Idempotency / edge cases**:
  - API-014 — re-registering `bob@demo` (duplicate email) → `409`, and exactly one `User` row for that email remains.
  - API-015 — registering a **new** email with the existing username `jake` → `409`.
  - API-016 — the stored hash is bcrypt cost 10 (`$2[aby]$10$` prefix) and never equals the plaintext.

### `POST /api/users/login`
- **Happy path**: API-017 — `{"user":{"email":"jake@demo","password":"Demo1234!"}}` → `200`, `{"user":{"email":"jake@demo","token":"<jwt>","username":"jake","bio":"I work at statefarm","image":<string|null>}}`.
- **Validation failures**: API-018 — missing `password` → `400`; API-019 — `email` not an email → `400`.
- **Auth failures**:
  - API-020 — correct email, wrong password `"WrongPass1!"` → `401` (**not** 400, **not** 403), and the body leaks no indication that the email exists.
  - API-021 — unknown email `nobody@demo` → `401`, and the response time is not trivially distinguishable from API-020 (no early-return-before-hash user enumeration).
- **Idempotency / edge cases**: API-022 — the platform-minted **ADMIN** account logs in successfully via this same endpoint → `200` with a token whose payload `role === "ADMIN"`. API-023 — two consecutive logins both succeed and both tokens independently authenticate `GET /api/user`.

### `GET /api/user`
- **Happy path**: API-024 — with `AUTH_JAKE` → `200`, `{"user":{"email":"jake@demo","token":"<jwt>","username":"jake","bio":"I work at statefarm","image":<string|null>}}`.
- **Validation failures**: n/a.
- **Auth failures**: API-025 — no header → `401`. API-026 — `Bearer garbage` → `401`. API-027 — a token signed with the wrong secret → `401`. API-028 — an expired token (`exp` in the past) → `401`. API-029 — `Token <valid jwt>` (legacy prefix) → `200` (both prefixes accepted).
- **Idempotency / edge cases**: API-030 — token for a user deleted from the DB after issuance → `401`, not `500`.

### `PUT /api/user`
- **Happy path**: API-031 — `AUTH_JAKE`, `{"user":{"bio":"Updated bio","image":"https://x/a.png"}}` → `200`; re-fetching `GET /api/user` shows the new `bio`/`image`; `email` and `username` unchanged.
- **Validation failures**:
  - API-032 — `{"user":{"email":"not-an-email"}}` → `400`.
  - API-033 — `{"user":{"password":"short7c"}}` → `400`; the old password still logs in afterwards.
  - API-034 — `{"user":{}}` (no fields) → `200` no-op, or `400`; either is acceptable but the record must be unchanged.
- **Auth failures**: API-035 — no header → `401`.
- **Idempotency / edge cases**:
  - API-036 — changing `password` to `"NewPass1234!"` → subsequent login with the old password → `401`, with the new password → `200`.
  - API-037 — changing `email` to one already owned by another user → `409`, and the caller's email is unchanged.
  - API-038 — applying the same body twice yields the same final state.

### `GET /api/profiles/:username`
- **Happy path**: API-039 — anonymous `GET /api/profiles/jake` → `200`, `{"profile":{"username":"jake","bio":"I work at statefarm","image":<string|null>,"following":false}}`.
- **Validation failures**: n/a.
- **Auth failures**: none — optional auth. API-040 — with an **invalid** token present the request still succeeds (`OptionalJwtAuthGuard` never throws) → `200`, `following:false`.
- **Idempotency / edge cases**:
  - API-041 — unknown username `ghost` → `404`.
  - API-042 — with `AUTH_BOB` after bob follows jake → `following:true`; before following → `following:false`.
  - API-043 — fetching one's own profile with `AUTH_JAKE` → `following:false`.
  - API-044 — the response never contains `email` or `passwordHash`.

### `POST /api/profiles/:username/follow`
- **Happy path**: API-045 — `AUTH_BOB` on `/api/profiles/jake/follow` → `200`, `{"profile":{...,"following":true}}`; one `Follow` row `[bob.id, jake.id]` exists.
- **Validation failures**: API-046 — self-follow `AUTH_JAKE` on `/api/profiles/jake/follow` → `422` (accept `400`), and no `Follow` row is created.
- **Auth failures**: API-047 — no token → `401` (**not** 403).
- **Idempotency / edge cases**: API-048 — following twice → second call `200` with `following:true` and still exactly **one** `Follow` row (no unique-constraint `500`). API-049 — unknown username → `404`.

### `DELETE /api/profiles/:username/follow`
- **Happy path**: API-050 — `AUTH_BOB` after following jake → `200`, `{"profile":{...,"following":false}}`; the `Follow` row is gone.
- **Validation failures**: n/a.
- **Auth failures**: API-051 — no token → `401`.
- **Idempotency / edge cases**: API-052 — unfollowing someone not followed → `200` with `following:false` (no `404`/`500`). API-053 — unknown username → `404`.

### `GET /api/articles`
- **Happy path**: API-054 — anonymous → `200`, `{"articles":[...],"articlesCount":<int>}`; every element matches the `article.view` shape `{slug,title,description,body,tagList,createdAt,updatedAt,favorited,favoritesCount,author:{username,bio,image,following}}`; ordered `createdAt` **descending**; the seeded `How to train your dragon` is present.
- **Validation failures**:
  - API-055 — `?limit=abc` → `400` (or coerced to the default 20; must not `500`).
  - API-056 — `?limit=-1` and `?offset=-1` → `400` or clamped to `>= 0`; never a Prisma error.
  - API-057 — `?limit=100000` → capped (assert returned length `<= 100`), never an unbounded scan.
- **Auth failures**: none — optional auth. API-058 — invalid token present → still `200`.
- **Idempotency / edge cases**:
  - API-059 — `?tag=dragons` → returns **only** the dragon article; `articlesCount === 1`; every returned `tagList` contains `dragons`.
  - API-060 — **duplicate guard**: with an article carrying both `dragons` and `training`, `?tag=dragons` returns it exactly **once** (assert `new Set(slugs).size === slugs.length`), and `articlesCount` equals the returned length when under `limit`.
  - API-061 — `?tag=nonexistent` → `{"articles":[],"articlesCount":0}`, status `200` (not 404).
  - API-062 — `?author=jake` → every article's `author.username === "jake"`.
  - API-063 — `?favorited=bob` after bob favorites the dragon article → exactly that article; after unfavoriting → empty.
  - API-064 — `?tag=dragons&author=jake` (combined filters) → the intersection, not the union.
  - API-065 — pagination: with ≥3 seeded articles, `?limit=1&offset=0` and `?limit=1&offset=1` return **different** slugs, and `articlesCount` reports the **total** (unfiltered by limit) in both.
  - API-066 — anonymous → every `favorited` is `false` and every `author.following` is `false`; with `AUTH_BOB` (following jake, favoriting the dragon article) → those flags are `true` on the right rows.
  - API-067 — `body` is included in list items per the declared `article.view` shape (assert consistently, whichever the implementation chose, and assert the same shaper is used by `GET /api/articles/:slug`).

### `GET /api/articles/feed`
- **Happy path**: API-068 — `AUTH_BOB` after bob follows jake → `200`, contains jake's articles only; `{articles, articlesCount}` shape; `createdAt desc`.
- **Validation failures**: API-069 — `?limit=abc` → `400` or defaulted, never `500`.
- **Auth failures**: API-070 — no token → `401`. API-071 — invalid token → `401` (this route is **guarded**, unlike the other GETs).
- **Idempotency / edge cases**:
  - API-072 — bob following nobody → `{"articles":[],"articlesCount":0}`, `200`.
  - API-073 — after bob unfollows jake → feed is empty again.
  - API-074 — bob's **own** articles do not appear in bob's feed (only followed authors').
  - API-075 — **route-order guard**: `/api/articles/feed` resolves to the feed handler, not to `GET /api/articles/:slug` with `slug="feed"` (assert `401` when unauthenticated, not `404`).

### `GET /api/articles/:slug`
- **Happy path**: API-076 — anonymous `GET /api/articles/how-to-train-your-dragon` → `200`, `{"article":{...}}` with `title:"How to train your dragon"`, `description:"Ever wonder how?"`, `tagList` containing `dragons` and `training` (assert sorted or set-compared, not order-dependent), `author.username:"jake"`.
- **Validation failures**: n/a.
- **Auth failures**: none — optional auth. API-077 — malformed token → still `200`.
- **Idempotency / edge cases**: API-078 — unknown slug → `404` with a JSON error body (not an HTML page). API-079 — with `AUTH_BOB` who has favorited it → `favorited:true`, `favoritesCount >= 1`. API-080 — `favoritesCount` equals the actual `Favorite` row count for that article.

### `POST /api/articles`
- **Happy path**: API-081 — `AUTH_JAKE`, `{"article":{"title":"My First Post","description":"d","body":"b","tagList":["dragons","newtag"]}}` → `201`, `article.slug` matches `^my-first-post-[a-z0-9]{6}$`, `tagList` set-equals the input, `author.username:"jake"`, `favorited:false`, `favoritesCount:0`.
- **Validation failures**: API-082 — missing `title` → `400`; missing `description` → `400`; missing `body` → `400`. API-083 — `tagList` omitted → `201` with `tagList: []`. API-084 — `tagList` not an array (e.g. `"dragons"`) → `400`.
- **Auth failures**: API-085 — **no token → `401`** (explicit 401-vs-403 assertion). API-086 — expired token → `401`.
- **Idempotency / edge cases**:
  - API-087 — posting the **same title twice** yields two articles with **different** slugs (random 6-char base36 suffix), both retrievable; no unique-index `500`.
  - API-088 — an existing tag (`dragons`) is reused, not duplicated: the `Tag` table still has exactly one `dragons` row afterwards.
  - API-089 — a title of only punctuation (`"!!! ???"`) still produces a non-empty, URL-safe slug (`strict:true`).
  - API-090 — the new article appears first in `GET /api/articles` (newest-first ordering).

### `PUT /api/articles/:slug`
- **Happy path**: API-091 — `AUTH_JAKE`, `{"article":{"description":"new desc"}}` on his own article → `200`, description updated, **slug unchanged** (title untouched), `updatedAt > createdAt`.
- **Validation failures**: API-092 — `{"article":{"title":""}}` → `400` and the article is unchanged.
- **Auth failures**: API-093 — no token → `401`.
- **Idempotency / edge cases**:
  - API-094 — **403 case**: `AUTH_BOB` updating jake's article → `403` (**not** 401, **not** 404), and a follow-up `GET` shows the article byte-identical to before (ownership checked *before* any mutation).
  - API-095 — **existence-before-ownership ordering**: `AUTH_BOB` on a **nonexistent** slug → `404`, not `403`.
  - API-096 — changing the title → slug is **regenerated** (new slug matches the new title's stem), the response returns the **new** slug, `GET` on the new slug → `200`, and `GET` on the old slug → `404`.
  - API-097 — updating `tagList` replaces the tag set (removed tags no longer appear in `tagList`; orphaned `ArticleTag` rows are deleted).

### `DELETE /api/articles/:slug`
- **Happy path**: API-098 — `AUTH_JAKE` deleting his own article → `200`/`204`; a follow-up `GET` on that slug → `404`; it is absent from `GET /api/articles`.
- **Validation failures**: n/a.
- **Auth failures**: API-099 — no token → `401`.
- **Idempotency / edge cases**:
  - API-100 — `AUTH_BOB` deleting jake's article → `403`, and the article **still exists** (`GET` → `200`).
  - API-101 — nonexistent slug with a valid token → `404` (not `403`).
  - API-102 — deleting an article cascades: its `Comment`, `ArticleTag`, and `Favorite` rows are removed; the `Tag` rows themselves survive.
  - API-103 — deleting twice → second call `404`.

### `POST /api/articles/:slug/favorite`
- **Happy path**: API-104 — `AUTH_BOB` on the dragon article → `200`, `{"article":{...,"favorited":true,"favoritesCount":<prev+1>}}`.
- **Validation failures**: n/a.
- **Auth failures**: API-105 — **no token → `401`** (explicit).
- **Idempotency / edge cases**:
  - API-106 — favoriting twice → second call `200`, `favoritesCount` unchanged from the first call, exactly one `Favorite` row (no `500` on the composite PK).
  - API-107 — unknown slug → `404`.
  - API-108 — jake favoriting his own article → allowed, `200`.
  - API-109 — the article now appears in `GET /api/articles?favorited=bob`.

### `DELETE /api/articles/:slug/favorite`
- **Happy path**: API-110 — `AUTH_BOB` after favoriting → `200`, `favorited:false`, `favoritesCount` back to the pre-favorite value.
- **Validation failures**: n/a.
- **Auth failures**: API-111 — no token → `401`.
- **Idempotency / edge cases**: API-112 — unfavoriting when not favorited → `200`, `favoritesCount` unchanged, no `500`. API-113 — unknown slug → `404`. API-114 — the article disappears from `GET /api/articles?favorited=bob`.

### `GET /api/articles/:slug/comments`
- **Happy path**: API-115 — anonymous on the dragon article → `200`, `{"comments":[{"id":<n>,"body":<str>,"createdAt":<iso>,"updatedAt":<iso>,"author":{"username","bio","image","following"}}]}`; the seeded comment is present.
- **Validation failures**: n/a.
- **Auth failures**: none — optional auth. API-116 — invalid token → still `200`.
- **Idempotency / edge cases**: API-117 — unknown slug → `404`. API-118 — an article with no comments → `{"comments":[]}`, `200`. API-119 — with `AUTH_BOB` following the comment author → `author.following:true`; anonymously → `false`. API-120 — no `email`/`passwordHash` in any author object.

### `POST /api/articles/:slug/comments`
- **Happy path**: API-121 — `AUTH_BOB`, `{"comment":{"body":"Nice post"}}` → `201`, `{"comment":{"id":<n>,"body":"Nice post","createdAt":<iso>,"author":{"username":"bob",...}}}`; it appears in the subsequent `GET`.
- **Validation failures**: API-122 — `{"comment":{"body":""}}` → `400`; API-123 — missing `body` → `400`; API-124 — `body` not a string → `400`.
- **Auth failures**: API-125 — **no token → `401`** (explicit).
- **Idempotency / edge cases**: API-126 — unknown slug → `404`. API-127 — posting the same body twice creates **two** distinct comments with distinct `id`s (comments are not deduped).

### `DELETE /api/articles/:slug/comments/:id`
- **Happy path**: API-128 — `AUTH_BOB` deleting his own comment → `200`/`204`; it is absent from the subsequent `GET /comments`.
- **Validation failures**: API-129 — non-numeric `:id` (e.g. `/comments/abc`) → `400` or `404`, never `500`.
- **Auth failures**: API-130 — no token → `401`.
- **Idempotency / edge cases**:
  - API-131 — `AUTH_JAKE` deleting **bob's** comment → `403`, and the comment still exists.
  - API-132 — unknown comment id with a valid token → `404` (existence checked before ownership).
  - API-133 — a comment id that exists but belongs to a **different** article than `:slug` → `404`.
  - API-134 — deleting twice → second call `404`.

### `GET /api/tags`
- **Happy path**: API-135 — anonymous → `200`, `{"tags":["dragons","training",...]}` — a flat array of strings, **not** objects; contains `dragons` and `training`.
- **Validation failures**: n/a.
- **Auth failures**: none (public) — API-136 — succeeds with no header and with a bad header.
- **Idempotency / edge cases**: API-137 — ordered by usage count **descending** (create 3 articles tagged `popular` and 1 tagged `rare`; assert `popular` precedes `rare`). API-138 — at most **20** tags returned when 25+ distinct tags exist. API-139 — no duplicate strings in the array.

### `GET /api/admin/settings`
> Derived from `.pipeline/tasks.md`, not from the spec body (the spec assumes no role column). Cases apply only if the admin route group ships; if it is dropped, move to Out of scope and assert `404`.
- **Happy path**: API-140 — `AUTH_ADMIN` → `200`, one entry per provisioned service (`postgresql` with key `DATABASE_URL`; `minio` with `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`), each with a boolean `configured` flag and **masked** values.
- **Validation failures**: n/a.
- **Auth failures**: API-141 — no token → `401`. API-142 — `AUTH_JAKE` (role `USER`) → **`403`** (explicit 401-vs-403 distinction).
- **Idempotency / edge cases**: API-143 — no raw secret appears in the response body (assert the literal `JWT_SECRET`/`DATABASE_URL` values are absent); a key whose env value is `PLACEHOLDER_CONFIGURE_IN_SETTINGS` reports `configured:false`.

### `PATCH /api/admin/settings`
- **Happy path**: API-144 — `AUTH_ADMIN`, `{"MINIO_BUCKET":"conduit-media"}` → `200`; a `SystemSetting` row `key="MINIO_BUCKET"` exists with that value; a follow-up `GET` reports `minio.configured` reflecting the new state.
- **Validation failures**: API-145 — an unknown/unlisted key → `400` and no row is written. API-146 — a non-string value → `400`.
- **Auth failures**: API-147 — no token → `401`. API-148 — `AUTH_JAKE` → `403`, and no `SystemSetting` row is written.
- **Idempotency / edge cases**: API-149 — PATCHing the same key twice **upserts** (one row, latest value, `updatedAt` advanced). API-150 — after PATCH, `resolveConfig("MINIO_BUCKET")` returns the persisted value when the env var is absent or is the placeholder; env takes precedence when set to a real value. API-151 — the response never echoes the raw secret back.

### Stale-`surface.json` reconciliation
- API-152 — `GET /trpc/users.findAll` and `GET /trpc/users.findById` return **`404`** after the scaffold tRPC demo plumbing is removed (`backend/src/trpc/*`, `backend/src/users/users.router.ts`, `frontend/src/app/trpc-client.types.ts`). If the team instead decides to keep tRPC, this case must be rewritten — it is the tripwire for that open question.

---

## UI / journey tests

All journeys run against the composed stack (`http://localhost:4200`) with nginx proxying `/api`.
Every assertion is on user-visible text or `data-testid` hooks, never on internal state.

### Journey: Anonymous landing page
- **Steps**: Navigate to `/` with a clean browser profile (no `localStorage`).
- **Expected outcomes**: UI-001 — all four required render markers are visible: **`Conduit`** (header brand + banner), **`Global Feed`** (tab label, exact literal), **`Popular Tags`** (an `<h3>` in the sidebar), **`How to train your dragon`** (seeded article preview). UI-002 — the header shows `Home`, `Sign in`, `Sign up` and does **not** show `New Article`, `Settings`, or a username. UI-003 — the `Your Feed` tab is **absent** for anonymous visitors. UI-004 — the rejected scaffold signatures are absent from the DOM: no `home-title">Users<`, no lingering `Loading...`, no `Failed to load users.`. UI-005 — each article preview shows author, formatted date, title, description, and a favorite-count button. UI-006 — the document title is `Conduit`.
- **Negative path**: UI-007 — with the backend stopped, the page still renders the shell (`Conduit`, header) and shows an explicit error state in the article list, not an infinite `Loading...` spinner and not a blank page.

### Journey: Filter by tag from the Popular Tags sidebar
- **Steps**: From `/`, click the `dragons` pill in the `Popular Tags` sidebar.
- **Expected outcomes**: UI-008 — the URL becomes `/?tag=dragons` (state lives in query params). UI-009 — a third tab labelled `#dragons` appears next to `Global Feed`. UI-010 — the list shows only the dragon article; the extra untagged seed articles are gone. UI-011 — reloading `/?tag=dragons` directly reproduces the same filtered view (deep-linkable). UI-012 — clicking `Global Feed` clears `?tag=` and restores the full list.
- **Negative path**: UI-013 — navigating to `/?tag=zzz-nonexistent` renders an explicit empty state ("No articles are here… yet."), not an error and not a blank list.

### Journey: Register a new account
- **Steps**: `/` → `Sign up` → fill `username=bob`, `email=bob@demo`, `password=Demo1234!` → submit.
- **Expected outcomes**: UI-014 — redirected to `/`; header now shows `Home`, `New Article`, `Settings`, and `bob`. UI-015 — a JWT is present in `localStorage`. UI-016 — a full page reload keeps bob signed in (session hydrated from `localStorage` on boot).
- **Negative path**: UI-017 — submitting with password `short7c` shows an inline field error and no navigation. UI-018 — re-submitting the duplicate email `jake@demo` shows a server error list (e.g. "email has already been taken") and the user stays on `/register`. UI-019 — the submit button is disabled or shows a pending state while the request is inflight (no double-submit).

### Journey: Sign in, including redirect-after-login
- **Steps**: While anonymous, navigate directly to `/settings`.
- **Expected outcomes**: UI-020 — redirected to `/login?redirect=%2Fsettings`. UI-021 — after signing in as `jake@demo` / `Demo1234!`, landed on `/settings`, not `/`. UI-022 — signing in from `/login` with no `?redirect=` lands on `/`.
- **Negative path**: UI-023 — wrong password shows an inline "email or password is invalid" error, stays on `/login`, and writes nothing to `localStorage`.

### Journey: Guarded routes reject anonymous access
- **Steps**: While anonymous, navigate in turn to `/editor`, `/editor/how-to-train-your-dragon`, `/settings`, `/?tab=feed`.
- **Expected outcomes**: UI-024 — each of `/editor`, `/editor/:slug`, `/settings` redirects to `/login?redirect=<encoded original url>`. UI-025 — `/?tab=feed` while anonymous falls back to the Global Feed (or redirects to login) rather than firing an unauthenticated `/api/articles/feed` call that renders a raw 401.
- **Negative path**: UI-026 — after the token is manually cleared from `localStorage` mid-session, the next guarded API call returns 401, the session is cleared by the interceptor, and the header reverts to `Sign in` / `Sign up` rather than showing a stale username.

### Journey: Publish a new article
- **Steps**: Signed in as bob → `New Article` → title `Bob's Test Article`, description `A test`, body `Hello world`, tags `testing` + `dragons` → `Publish Article`.
- **Expected outcomes**: UI-027 — navigated to `/article/<new-slug>` where the slug matches `bobs-test-article-[a-z0-9]{6}`. UI-028 — the article page shows the title, body, and both tags. UI-029 — returning to `/` shows the article **first** in `Global Feed` (newest first). UI-030 — `/?tag=testing` shows it; `Popular Tags` now includes `testing`.
- **Negative path**: UI-031 — submitting with an empty title shows a validation error and does not navigate. UI-032 — a server 500/503 renders an error list on the editor and preserves the typed form values (no data loss).

### Journey: Edit an article (slug regeneration)
- **Steps**: As bob, open his article → `Edit Article` → change the title to `Bob's Renamed Article` → `Publish Article`.
- **Expected outcomes**: UI-033 — the editor pre-populates all four fields from the existing article. UI-034 — after save the browser is at `/article/bobs-renamed-article-<suffix>` — the **new** slug returned by the API, not the old one (stale-slug regression guard). UI-035 — the page renders the updated title. UI-036 — navigating to the **old** slug URL shows the article-not-found state, not a crash.
- **Negative path**: UI-037 — as jake, navigating directly to `/editor/<bob's slug>` results in a forbidden/error state, and no destructive request is issued.

### Journey: Delete an article via the confirm modal
- **Steps**: As bob on his own article page → click `Delete Article`.
- **Expected outcomes**: UI-038 — the URL gains `?modal=delete-article` and a confirmation modal is visible. UI-039 — clicking Cancel closes the modal, removes `?modal=` from the URL, and the article still exists. UI-040 — clicking Confirm deletes it and navigates to `/`; the article is gone from `Global Feed`. UI-041 — loading `/article/<slug>?modal=delete-article` directly opens the modal (query-param-driven state).
- **Negative path**: UI-042 — viewing **jake's** article as bob shows **no** Edit/Delete controls at all (`author.username !== currentUser.username`).

### Journey: Comment on an article, then delete the comment
- **Steps**: As bob, open jake's dragon article → type `Great article!` in the comment form → submit → then click the delete (trash) icon on that comment → confirm.
- **Expected outcomes**: UI-043 — the new comment card appears immediately with author `bob`, avatar, and a timestamp. UI-044 — the comment form clears after a successful post. UI-045 — the delete icon is shown on bob's own comment. UI-046 — the delete flow sets `?modal=delete-comment&commentId=<id>`; confirming removes the card and the URL param. UI-047 — after reload the comment is gone (persisted, not just optimistic UI).
- **Negative path**: UI-048 — **anonymous** on the same article sees no comment form but a `Sign in to add comments` link that navigates to `/login`. UI-049 — bob sees **no** delete icon on jake's seeded comment. UI-050 — submitting an empty comment is blocked client-side (no request fired).

### Journey: Favorite and unfavorite an article
- **Steps**: As bob, on jake's dragon article, click the favorite button; then click it again.
- **Expected outcomes**: UI-051 — the count increments by exactly 1 and the button switches to its active/favorited style on the first click. UI-052 — the same article's preview on `/` shows the incremented count (state consistent across views after navigation). UI-053 — clicking again decrements the count by 1 and clears the active style. UI-054 — after a reload the final state persists.
- **Negative path**: UI-055 — clicking favorite while **anonymous** redirects to `/login` (or shows a sign-in prompt) rather than firing a 401 that surfaces as an unhandled error. UI-056 — double-clicking rapidly does not push the count to +2.

### Journey: Follow an author and see Your Feed populate
- **Steps**: As bob (following nobody), click `Your Feed` → observe empty → open jake's article → click `Follow jake` → return to `/?tab=feed`.
- **Expected outcomes**: UI-057 — `Your Feed` is visible in the tab list for authenticated users. UI-058 — before following, `Your Feed` shows an explicit empty state, not a spinner or an error. UI-059 — the follow button label toggles to `Unfollow jake` immediately. UI-060 — `Your Feed` now lists jake's articles including `How to train your dragon`, and the URL is `/?tab=feed`. UI-061 — clicking `Unfollow jake` empties `Your Feed` again.
- **Negative path**: UI-062 — an anonymous visitor sees no `Follow` button state change; clicking it routes to login rather than erroring.

### Journey: Profile page and its two tabs
- **Steps**: Click the author name `jake` from an article preview → land on `/profile/jake` → click `Favorited Articles`.
- **Expected outcomes**: UI-063 — the profile shows jake's username, bio `I work at statefarm`, and image. UI-064 — the default child route (`''`) shows the `My Articles` tab with jake's authored articles. UI-065 — clicking `Favorited Articles` navigates to `/profile/jake/favorites` and shows only articles jake has favorited. UI-066 — viewing **one's own** profile shows `Edit profile settings` (linking to `/settings`) instead of a Follow button. UI-067 — viewing another user's profile shows a working Follow/Unfollow button whose state matches `/api/profiles/:username`.
- **Negative path**: UI-068 — `/profile/ghost` (unknown user) shows a not-found state, not a blank page or a stack trace.

### Journey: Update settings and log out
- **Steps**: As jake → `Settings` → change bio to `Now I write about dragons` and image URL → `Update Settings`; then click `Or click here to logout`.
- **Expected outcomes**: UI-069 — the form pre-fills with the current bio/image/email/username and an **empty** password field. UI-070 — after saving, the header username and `/profile/jake` reflect the new bio. UI-071 — the logout link clears `localStorage`, returns the header to `Sign in`/`Sign up`, and navigates to `/`. UI-072 — after logout, `/settings` redirects to `/login?redirect=%2Fsettings`.
- **Negative path**: UI-073 — entering an invalid email shows an inline error and does not save. UI-074 — entering a 7-char password shows an error, and the old password still logs in afterwards.

### Journey: Pagination on the Global Feed
- **Steps**: With more than 20 articles seeded/created, load `/` and click page 2.
- **Expected outcomes**: UI-075 — page 1 shows at most 20 previews. UI-076 — clicking page 2 sets `?page=2` in the URL and shows a **different**, non-overlapping set. UI-077 — deep-linking to `/?page=2` directly reproduces that page. UI-078 — pagination state combines with `?tag=` (e.g. `/?tag=dragons&page=1`) without losing the filter.
- **Negative path**: UI-079 — `/?page=999` shows an empty state, not an error.

### Journey: Admin settings page (role-gated)
> Applies only if the `/admin/settings` route group ships (see the tasks.md open question on roles).
- **Steps**: Sign in as the platform ADMIN account → observe the header → navigate to `/admin/settings`.
- **Expected outcomes**: UI-080 — an `Admin` link is visible in the header for the ADMIN user only. UI-081 — the page shows one card per provisioned service (`postgresql`, `minio`) each with a configured/unconfigured badge. UI-082 — existing credential values render **masked**, never in plaintext. UI-083 — editing `MINIO_BUCKET` and saving shows success feedback, and a reload shows the badge/value updated.
- **Negative path**: UI-084 — as `jake` (role `USER`), no `Admin` link is rendered, and navigating directly to `/admin/settings` is blocked by the admin guard (redirect or forbidden state, never the credential form). UI-085 — a save that returns 403 shows an error message rather than silently appearing to succeed.

---

## Data integrity tests

- DATA-001 — **Passwords**: no `User` row ever stores a plaintext password; every `passwordHash` matches `^\$2[aby]\$10\$` (bcrypt, cost 10). No API response, anywhere, contains a `password` or `passwordHash` key.
- DATA-002 — **Uniqueness**: `User.email`, `User.username`, `Article.slug`, and `Tag.name` are enforced by unique indexes at the **database** level, not just in service code (assert a direct duplicate insert is rejected by Postgres).
- DATA-003 — **Composite PKs**: `Favorite` is keyed `[userId, articleId]` and `Follow` is keyed `[followerId, followedId]`; a duplicate insert of either fails at the DB level, so favorite/follow endpoints must be idempotent by design (API-048, API-106).
- DATA-004 — **Article delete cascade**: deleting an `Article` removes all of its `Comment`, `ArticleTag`, and `Favorite` rows and leaves zero orphans; `Tag` rows survive.
- DATA-005 — **User delete cascade**: deleting a `User` removes their `Article` rows (and transitively those articles' comments/tags/favorites) and their `Follow` rows in both directions; no `Comment.authorId` or `Article.authorId` dangles.
- DATA-006 — **Favorite count truth**: for every article, the rendered `favoritesCount` equals `SELECT count(*) FROM "Favorite" WHERE "articleId" = ?` after every favorite/unfavorite mutation.
- DATA-007 — **Tag join has no fan-out**: filtering by a tag on an article with multiple tags yields exactly one row per article; `articlesCount` equals the number of **distinct** matching articles, never the `ArticleTag` row count.
- DATA-008 — **Tag reuse**: publishing N articles that all use `dragons` leaves exactly **one** `Tag` row named `dragons` and N `ArticleTag` rows.
- DATA-009 — **Orphaned ArticleTag on edit**: updating an article's `tagList` to drop a tag deletes the corresponding `ArticleTag` row (no stale links surfacing in later tag filters).
- DATA-010 — **Slug rewrite is atomic**: after a title-change update, exactly one `Article` row holds the new slug and zero rows hold the old one.
- DATA-011 — **No self-follow rows**: no `Follow` row exists where `followerId = followedId`, under any sequence of API calls.
- DATA-012 — **Seed idempotency**: running the seed script **three** times in a row (simulating pod restarts) exits 0 every time and leaves identical row counts for `User`, `Article`, `Comment`, `Tag`, `ArticleTag` — all writes are `upsert`/`skipDuplicates`. The platform `ColossusAccount` + matching `User` rows (ADMIN always present) survive re-seeding unchanged.
- DATA-013 — **Migration + seed on boot**: `docker-entrypoint.sh` runs `prisma migrate deploy` before the seed and before `main.js`; a container started against an empty database reaches a `200` on `/api/health/deep` without manual intervention.
- DATA-014 — **Timestamps**: `createdAt` is set on insert and never mutated; `updatedAt` strictly advances on every article/comment update.
- DATA-015 — **Legacy schema preserved**: the `Role` enum (`USER`, `MANAGER`, `ADMIN`) and the `ColossusAccount` model still exist after the Conduit migration; the migration is additive and does not drop them.
- DATA-016 — **SystemSetting upsert**: `PATCH /api/admin/settings` on the same key twice leaves exactly one row with the latest value and an advanced `updatedAt`.

---

## Infrastructure / deployment tests

- INFRA-1 — **Angular output path**: the frontend `Dockerfile` `COPY` source matches the `outputDir` in `colossus.yaml` (`dist/frontend/browser`) and the path the installed Angular version actually emits. Assert `/usr/share/nginx/html/index.html` exists inside the built image; `curl -I http://localhost:4200/` → `200`, not `403`/`404`. This is the single highest-risk failure in the build (zero markers render if it is wrong).
- INFRA-2 — **SPA fallback**: `curl http://localhost:4200/article/how-to-train-your-dragon` → `200` returning `index.html` (deep links survive a hard refresh, `try_files $uri $uri/ /index.html`).
- INFRA-3 — **API proxy**: `curl http://localhost:4200/api/health` → `200` (nginx proxies `/api/` to `conduit-backend:3000`), proving the browser sees a same-origin API with no build-time URL config.
- INFRA-4 — **Backend port**: the backend listens on **3000** as the spec and `k8s/backend.yaml` require; the `colossus.yaml` `backend.port: 3001` mismatch is either corrected or proven irrelevant. `curl localhost:3000/api/health/deep` → `200` after migrations.
- INFRA-5 — **Health probes**: `k8s/backend.yaml` sets liveness `/api/health` and readiness `/api/health/deep`; `replicas: 1` (or migrations moved to an initContainer/Job) so concurrent `migrate deploy` runs cannot race.
- INFRA-6 — **JWT secret fail-fast**: with `JWT_SECRET` unset, the backend refuses to boot (non-zero exit with a clear message) rather than starting with an insecure default. Tokens signed with a different secret are rejected (API-027).
- INFRA-7 — **Compose smoke**: `docker compose up` from a clean volume reaches a state where `http://localhost:4200` renders all four markers (`Conduit`, `Global Feed`, `How to train your dragon`, `Popular Tags`) — the same assertion as UI-001, run against the composed stack rather than the dev server.

---

## Out of scope

- **OOS-1 — tRPC endpoints.** `GET /trpc/users.findAll` / `GET /trpc/users.findById` from the stale `surface.json` are scaffold demo plumbing. The spec defines a plain REST surface; per the tasks.md open question these modules are to be deleted. Only the removal tripwire (API-152) is tested — no functional tRPC coverage.
- **OOS-2 — Scaffold demo testIds.** `home-title`, `users-loading`, `users-error`, `users-list` from `surface.json` describe the deleted users demo. UI assertions use Conduit's own markers and testIds instead; the only carry-over is the negative assertion UI-004.
- **OOS-3 — MinIO object storage / image upload.** The spec models `image` as a plain URL string and never describes uploads. MinIO is tested only as configurable credentials in `/admin/settings` (API-140…API-151). No upload, bucket, or presigned-URL coverage.
- **OOS-4 — `MANAGER` role behaviour.** The `Role` enum retains `MANAGER`, but neither the spec nor tasks.md defines any MANAGER-specific capability. Only `USER` vs `ADMIN` is exercised.
- **OOS-5 — "First registered user is admin".** The spec's assumption is explicitly superseded by the platform-minted ADMIN account (tasks.md). No test asserts that the first registrant gains elevated privileges — API-011 asserts the opposite (registration cannot self-assign a role).
- **OOS-6 — Markdown rendering of article bodies.** The spec says "markdown-ish" and never specifies a renderer or sanitizer. Body content is asserted as present text only; no markdown-syntax or XSS-sanitization assertions. **Flag for follow-up** — if a renderer with `innerHTML` is introduced, XSS coverage becomes mandatory.
- **OOS-7 — Rate limiting, password reset, email verification, refresh tokens.** None appear in the spec. Token expiry is asserted structurally (7-day `exp`, API-007) but no refresh flow is tested.
- **OOS-8 — Ingress TLS / hostnames.** `k8s/ingress.yaml` is asserted only to route `/` → frontend (INFRA-5 context). Certificates, DNS, and the `baseHref: /{{IMAGE_NAME}}/` substitution are deploy-pipeline concerns the spec does not define.
- **OOS-9 — Accessibility, responsive breakpoints, and browser matrix.** `styles.css` is specified as "RealWorld-like" with no measurable acceptance criteria; no a11y-audit or visual-regression cases are defined.
- **OOS-10 — Performance and load.** No latency, throughput, or concurrency targets appear in the spec. API-057 (limit capping) is a correctness case, not a performance one.
- **OOS-11 — `docker-compose` frontend Dockerfile path conflict.** `colossus.stack.json` declares `web/Dockerfile.frontend` while the repo has `frontend/Dockerfile`. INFRA-1 tests whichever the deploy pipeline actually builds; reconciling the declaration is a pipeline-config task, not a test case.
