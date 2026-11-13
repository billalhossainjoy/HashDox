# HashDox

A secrets management platform. This branch contains only the initial pnpm workspace, Vite/React frontend, and Hono/Cloudflare Workers API.

## Requirements

- Node.js 22 or newer
- pnpm 10.x (Corepack recommended)

## Getting started

```bash
corepack enable
pnpm install
```

Start the frontend and API in separate terminals:

```bash
pnpm dev:web
pnpm dev:api
```

- Web: http://localhost:5173
- API health: http://localhost:8787/api/health

The API health endpoint is public and returns no secret information.

## Structure

```text
apps/
  web/  # React, Vite, Material UI
  api/  # Cloudflare Workers, Hono
```

D1, Drizzle, Better Auth, encryption, email, and product functionality will be introduced in separate reviewed branches.

## Branching and commits

- Branch naming: `chore/<topic>`, `feat/<topic>`, `fix/<topic>`
- Conventional Commits: `type(scope): summary`
- Do not commit environment files, API keys, or credentials.
- Submit changes for review before merging into `main`.

## Validation

```bash
pnpm typecheck
pnpm build
```

No deployment has been configured in this setup branch.
