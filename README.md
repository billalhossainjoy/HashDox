# HashDox

A security-focused secrets management platform.

This branch adds the initial Cloudflare D1 + Drizzle wiring to the React/Vite and Hono/Cloudflare Workers workspace. Authentication, production databases, encryption, and business schemas are intentionally not implemented yet.

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

Note: the initial workspace has not yet generated a `pnpm-lock.yaml`; run `pnpm install` and commit the resulting lockfile before shipping.

## Git conventions

Branch names: `chore/<topic>`, `feat/<topic>`, `fix/<topic>`.

Commits: `type(scope): summary` (Conventional Commits).

Review each branch before merging. Do not deploy without explicit approval.
