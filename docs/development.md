# Local development and checks

## Requirements
- Node.js >=22
- pnpm 10.28.0 via Corepack

## Local setup
```bash
corepack enable
pnpm install
pnpm typecheck
pnpm build
```

Start API and frontend separately:

```bash
pnpm dev:api
pnpm dev:web
```

## Google OAuth

The auth foundation is not production-ready until local credentials, database
migrations, session cookie behavior and the owner allowlist have been tested.

For local auth, copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars`;
edit the ignored local file with your Google credentials, owner email and a
strong Better Auth secret. Set the Google OAuth authorized redirect URI to
`http://localhost:8787/api/auth/callback/google`.

Do not commit .dev.vars, .env, production credentials, or any secret values.

## Database workflow

Generate migrations from the Drizzle schema:

```bash
pnpm --filter @hashdox/api db:generate
pnpm --filter @hashdox/api db:migrate:local
```

Review all generated SQL before committing or applying changes. Do **not**
run the remote migration command against staging or production without an
explicit review and the correct Cloudflare D1 database ID.

## CI

The validate workflow runs TypeScript checks, production builds (dry-run
for Workers), and migration generation without OAuth credentials or deployed
resources. On setup and authentication branches, CI is **only a safety net**:
it cannot verify a real Google login, OAuth callback, remote D1 access,
CORS, cookies, or secure key handling.

The generated `pnpm-lock.yaml` is committed to the integration branch.
CI now uses `pnpm install --frozen-lockfile` exclusively so dependency drift
fails the build rather than changing installed versions.

CI generates Drizzle migration SQL and applies it to an isolated **local**
D1 database using Wrangler. This confirms that the SQL can be applied,
but does not test Cloudflare production D1 or the Better Auth OAuth flow.

The workflow also uploads generated Drizzle migration SQL for review. Do not apply it remotely without a separate authorization.

**Note:** No real Google OAuth login or D1 runtime migration is performed by CI. Local/hosted authentication validation remains a separate required step.

## Projects API (owner-only foundation)

All endpoints below require an authenticated owner session. The backend
enforces access for reads and writes through the shared `requireOwner`
middleware; the frontend must not be trusted to enforce authorization.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/projects?page=1` | List 20 projects per page with total count |
| GET | `/api/projects/:id` | Get a project |
| POST | `/api/projects` | Create with JSON `{"name":"Example"}` |
| PATCH | `/api/projects/:id` | Rename with JSON `{"name":"Renamed"}` |
| DELETE | `/api/projects/:id` | Delete a project |

Names are trimmed, require 1–100 characters, and reject unexpected input
properties. This stage implements *project metadata only*; it does **not**
grant access to other users, implement environments, or store secrets.

The new `projects` table requires a **reviewed migration** before runtime
usage. CI validates schema generation and applies migrations to local D1;
no remote D1 database is migrated automatically. Project API integration
tests with a real authenticated Worker runtime are still needed.

## Projects frontend

The authenticated `/projects` route calls the owner-protected
`/api/projects` endpoints using `fetch` with credentials. TanStack Query
loads paginated project lists and invalidates cached project pages after
create/update/delete operations.

The Material UI table provides 20-row server pagination, page-scoped selection,
an action menu for renaming/deleting, and explicit confirmation before deleting
one or multiple projects. A signed-out user sees the Google sign-in screen.

The frontend is not a substitute for server authorization. Deploy frontend and
API under tested cookie and CORS settings; real Google OAuth end-to-end and
live D1 integration tests remain outstanding.

## Project environments

New projects atomically receive **Development**, **Staging**, and
**Production**. The default slugs are `development`, `staging`, and
`production`. Existing projects created before this feature are **not**
automatically backfilled; they can add environments manually. The UI
opens at `/projects/:projectId/environments` through the Projects table.

Owner-only routes (under the existing project auth middleware):

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/projects/:projectId/environments` | List environments |
| POST | `/api/projects/:projectId/environments` | Create custom environment |
| PATCH | `/api/projects/:projectId/environments/:environmentId` | Rename |
| DELETE | `/api/projects/:projectId/environments/:environmentId` | Delete |

The JSON request body for creation and rename is `{"name":"Preview"}`.
Names are at most 60 characters; slugs are unique per project and **not
changed by rename**, to preserve stable identities for upcoming secrets.
Database-level foreign keys cascade deletion when the parent project is
removed. The frontend confirms deletions.

This stage stores only environment metadata, **not** secrets, access rules,
or encryption keys. No remote D1 migrations are performed automatically.

## Local Worker authorization smoke tests

After local D1 migration, run:

```bash
bash apps/api/scripts/run-worker-smoke.sh
```

This starts Wrangler **locally** with placeholder, nonfunctional OAuth
configuration and checks real HTTP routing in the Workers runtime. It verifies
the health endpoint, rejects anonymous/fake-cookie reads and writes against
projects, environments, folders, secrets, reveal and audit routes, and checks
CORS allow/disallow behavior. It is wired into CI after isolated local D1
migration setup. No OAuth network connection is attempted.

These tests **do not establish** that a real owner session can create,
reveal or modify secrets; they do not test Google OAuth, legitimate session
cookies, production Worker security, or remote D1. Those require separate
authorized authenticated integration testing before deployment. The test
credentials are not valid production credentials.
