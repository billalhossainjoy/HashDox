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
