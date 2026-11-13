# HashDox

A security-focused secrets management platform.

The frontend foundation uses React/Vite, Material UI, TanStack Router, and TanStack Query. The API uses Hono/Cloudflare Workers with initial D1 + Drizzle wiring. Authentication, production databases, encryption, and business schemas are intentionally not implemented yet.

## Requirements

- Node.js 22+
- pnpm 10.x

## Start locally

```bash
corepack enable
pnpm install
pnpm dev:api
```

In another terminal:

```bash
pnpm dev:web
```

- Web: http://localhost:5173
- API: http://localhost:8787/api/health

## Frontend foundation

- `apps/web/src/main.tsx` wires Material UI, TanStack Query and TanStack Router providers.
- `apps/web/src/theme.ts` holds initial Material UI tokens (not a completed Figma implementation).
- `apps/web/src/router.tsx` defines a small typed route tree with a root layout and a home route.
- `apps/web/src/components/AppShell.tsx` contains the reusable application shell.
- `apps/web/src/lib/query-client.ts` creates the Query client. **Never cache secret plaintext** when secret endpoints are added.
- Add new routes incrementally; this starter uses simple code-based routing without generated routes.

No authentication, private pages, or API integration are included yet.

## Database setup

The API binds a local D1 database as `DB`. Wrangler uses local persistence by default during `wrangler dev`; the all-zero database ID in `apps/api/wrangler.jsonc` is a **local placeholder only**. **Do not deploy with this ID.** No remote D1 database has been created.

Database client: `apps/api/src/db/client.ts`. Drizzle schema: `apps/api/src/db/schema.ts`.

No application tables or migrations exist yet. After defining the first schema in a later branch:

```bash
pnpm --filter @hashdox/api db:generate
pnpm --filter @hashdox/api db:migrate:local
```

Before any remote migration or deployment:
1. Create a dedicated D1 database in the appropriate Cloudflare account with `wrangler d1 create`.
2. Replace the placeholder `database_id` and `database_name` in a reviewed environment-specific Wrangler configuration.
3. Keep staging and production databases separate.
4. Review the migration SQL and confirm the target before running `db:migrate:remote`.

Do not connect local development to production D1. Never check in API keys, OAuth credentials, or secret values.

## Workspace

```text
apps/
  web/ # React, Vite, Material UI
  api/ # Hono, Workers, D1, Drizzle
```

## Quality checks

```bash
pnpm typecheck
pnpm build
```

Note: the initial workspace has not yet generated a `pnpm-lock.yaml`; run `pnpm install` and commit the resulting lockfile before shipping. The app has not been typechecked or built in this environment.

## Git conventions

Branch names: `chore/<topic>`, `feat/<topic>`, `fix/<topic>`.

Commits: `type(scope): summary` (Conventional Commits).

Review each branch before merging. Do not deploy without explicit approval.
