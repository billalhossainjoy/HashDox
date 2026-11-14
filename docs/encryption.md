# HashDox encryption foundation — review required

## Approach

This is **server-side envelope encryption**, not zero-knowledge/client-side
encryption. The trusted Cloudflare Worker receives plaintext and can decrypt
it during authorized requests.

- A random 32-byte AES-256-GCM **DEK** is generated per project.
- A 32-byte master **KEK** is provided at runtime via the
  `HASHDOX_MASTER_KEY_B64` Worker secret, not stored in D1.
- The project DEK is wrapped with the KEK using a fresh 96-bit nonce,
  128-bit authentication tag, and authenticated project/key-version context.
- Wrapped DEK ciphertext, nonce and key version are stored in D1 in
  `project_data_keys`. Plaintext DEKs and KEKs must never be logged or
  returned through HTTP endpoints.
- Future secret values are encrypted under the project DEK with a new random
  96-bit nonce and authenticated project/environment/secret identity context.
  This prevents ciphertext copy/paste between different identities.
- The implementation uses Web Crypto only; key bytes stay in request memory
  while needed. Explicit key-byte clearing is best-effort and cannot guarantee
  removal from JavaScript engine internals.

## Configuration

Generate the KEK **offline** with a cryptographically secure random source,
then store the base64-encoded 32 bytes as a secret binding on the Worker.

For example, in a trusted terminal:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Do not commit this value to Git, put it in a Vite `VITE_` environment variable,
copy it into a chat message, or store it in D1. Never place the key in
`wrangler.jsonc`. Separate development, staging, and production keys.

## Security boundaries and limitations

The `getProjectDataKey` service intentionally is **not exposed as an API
route**. Before any caller uses it, it must validate a server-side session,
authorize access to that project, and confirm the project belongs to the
request's target context. Authentication alone does not grant secret access.

The initial schema supports **one active master-key version (1)**. It does
not yet implement KEK rotation, recovery, encrypted secret persistence,
audit logging, environment-specific permissions, rate limiting, or HSM-backed
key custody. Losing the KEK makes existing data irrecoverable. Changing the
KEK without a reviewed rewrapping process makes existing project keys
undecryptable.

No plaintext secret data is stored by this branch. CI unit tests cover
round-trips, randomness, wrong contexts, tampered values and wrong keys.
Passing unit tests does not constitute an independent security audit.

Review and apply the new local D1 migration before running integration tests.
**Never apply remote migrations or deploy without explicit approval.**

## Environment-scoped encrypted secrets API

This stage adds an owner-only API for encrypted values in an existing project
environment. The backend verifies the exact project/environment association
before any key retrieval or secret operation.

| Method | Endpoint under `/api/projects/:projectId/environments/:environmentId/secrets` |
| --- | --- |
| GET | `/` — list metadata only, maximum 500 (no plaintext or ciphertext) |
| POST | `/` — create a secret with `{"key":"DATABASE_URL","value":"..."}` |
| PATCH | `/:secretId` — replace key/value with `{"key":"DATABASE_URL","value":"..."}` |
| POST | `/:secretId/reveal` — explicitly return plaintext value |
| DELETE | `/:secretId` — delete ciphertext |

Values must be strings with no more than 16 KiB of UTF-8 bytes (including
empty strings). Keys use env-style letters, digits and underscores, beginning
with a letter or underscore (maximum 128 characters). Keys are unique in each
environment. Payloads with unexpected fields are rejected.

The `secrets` table stores ciphertext, a random nonce, a project ID,
environment ID and a key name — never a plaintext secret value. Unique indexes
prevent duplicate secret names. The authenticated data binds each ciphertext to
its precise project, environment and secret record ID; moving the ciphertext
to another record will fail AES-GCM verification.

Every secrets route checks owner authorization. Responses include
`Cache-Control: no-store`. Reveal is a separate POST and is **never** part
of a list response. Clients must not put revealed values into persistent
TanStack Query caches, browser storage, analytics, or logs. The reveal
endpoint should be restricted further before introducing multi-user access.

**Deployment remains blocked** until real Google OAuth and Workers
integration tests, audit events for secret reveal/mutations, rate limiting,
a reviewed KEK rotation and recovery plan, and a full encryption security
review are completed. This branch creates no live secrets or remote migrations.

## Nested secret folders

Secret folders belong to a single project and environment and may contain
subfolders. Each folder has a scoped parent ID; unique indexes reject
duplicate sibling names. On deletion, nonempty folders are rejected
instead of cascading deletion of contained secrets or nested folders.

- `GET /api/projects/:projectId/environments/:environmentId/folders` lists folder metadata
- `POST .../folders` accepts `{"name":"Infrastructure","parentId":null}` (or a parent folder ID)
- `PATCH .../folders/:folderId` renames a folder
- `DELETE .../folders/:folderId` deletes **empty** folders
- `GET .../secrets?folderId=:folderId` lists only a folder's secrets; without `folderId` lists root secrets
- `POST .../secrets` optionally accepts `folderId`, placing a new secret into that folder
- `PATCH .../secrets/:secretId/folder` accepts `{"folderId":null}` or a folder ID to move the ciphertext

Secret ciphertext is bound to project/environment/secret ID, not folder ID,
so moving a secret does not require decrypting or changing its crypto context.
All folder and move operations validate the project and environment scope.
This iteration does not support moving folders between parents.

Remote migrations, authenticated Worker end-to-end tests, security audit and
production deployment are still outstanding.

## Reorganizing nested folders

`PATCH /api/projects/:projectId/environments/:environmentId/folders/:folderId/parent`
accepts `{"folderId":null}` to move a folder to root, or a folder ID to
nest it beneath another folder. The API validates the owner, project and
environment, rejects moves into the folder itself or any of its descendants,
and preserves folder IDs and their existing secrets. Unique sibling-name
constraints remain enforced.

The Secrets screen includes a **Move folder** dialog. It filters out
the selected folder and its descendants as possible destinations, while
the server independently rejects invalid targets.

**Concurrency limitation:** the initial cycle prevention checks the hierarchy
before updating it. Concurrent reparenting operations require database-level
serialized validation before this should be used with multiple writers.
This feature does not move folders across projects or environments.

## Secret operation audit trail

A new `secret_audit_events` table stores only project, environment and
secret **IDs**, a predefined action, a generated event ID and a timestamp.
It never stores plaintext values, encryption keys, secret names, request
bodies, headers or IP addresses.

Actions: `secret.created`, `secret.updated`, `secret.moved`,
`secret.deleted`, and `secret.reveal_requested`. Successful secret
mutations and their audit inserts use the same D1 batch to avoid a
successful write without an audit record. Reveal requests are recorded
before decryption and response; failed decryptions may therefore appear
as reveal attempts, not successful reveals. Missing/deleted secret IDs
are not logged by these endpoints.

Owner-only, no-store read endpoint:
`GET /api/projects/:projectId/audit`. Returns up to 100 newest events;
`?before=<timestamp_ms>` requests earlier timestamped entries.

Audit records are metadata-only and not a substitute for independent,
tamper-evident logs. Project deletion currently cascades its audit history.
Retention, export, tamper resistance, rate limiting, complete security
integration testing and incident reporting remain future work. This
change is not deployed and does not apply remote migrations.

## Atomic folder reparenting

Folder moves now validate destination ancestry **within the same SQLite
UPDATE statement** that changes the parent. A recursive CTE checks that
the destination is in the same project/environment and does not lead back
to the folder being moved. SQLite serializes writes to prevent two
simultaneous opposing moves from both applying stale ancestry decisions.
The sibling-name unique index and parent foreign key remain enforced.

Authenticated local Worker integration checks send opposing moves in
parallel and verify that precisely one succeeds and no parent cycle
remains. This protects the reparent endpoint; other writers must also
use these invariants. Future work should add database-level checks or
triggers to enforce scope for **all** folder/secret mutations, including
direct SQL/migrations and older preexisting data.
