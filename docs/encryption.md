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
