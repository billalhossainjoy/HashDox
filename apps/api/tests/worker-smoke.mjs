import assert from 'node:assert/strict';

const origin = process.env.HASHDOX_TEST_API_URL || 'http://127.0.0.1:8787';

async function check(path, { method = 'GET', headers = undefined, body = undefined } = {}, expected = 401) {
  const response = await fetch(origin + path, {
    method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(6000),
  });
  assert.equal(response.status, expected, `${method} ${path}: expected ${expected}, got ${response.status}`);
  return response;
}

const health = await check('/api/health', {}, 200);
assert.deepEqual(await health.json(), { status: 'ok', service: 'hashdox-api' });

const protectedPaths = [
  '/api/me',
  '/api/projects',
  '/api/projects/project-1',
  '/api/projects/project-1/environments',
  '/api/projects/project-1/environments/env-1',
  '/api/projects/project-1/environments/env-1/folders',
  '/api/projects/project-1/environments/env-1/secrets',
  '/api/projects/project-1/audit',
];

for (const path of protectedPaths) {
  const response = await check(path);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
}
await check('/api/projects', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'unauthorized' }),
});
await check('/api/projects/project-1/environments/env-1/secrets/secret-1/reveal', {
  method: 'POST',
});
await check('/api/projects/project-1/environments/env-1/secrets/secret-1', {
  method: 'DELETE',
});
await check('/api/projects/project-1/environments/env-1/folders/folder-1/parent', {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ folderId: null }),
});

const originHeaders = { Origin: 'https://untrusted.example' };
const disallowedOrigin = await check('/api/projects', { headers: originHeaders });
assert.notEqual(disallowedOrigin.headers.get('access-control-allow-origin'), 'https://untrusted.example');
const allowedOrigin = await check('/api/projects', { headers: { Origin: 'http://localhost:5173' } });
assert.equal(allowedOrigin.headers.get('access-control-allow-origin'), 'http://localhost:5173');

const fakeCookie = await check('/api/projects', {
  headers: { Cookie: 'better-auth.session_token=forged-not-a-real-session' },
});
assert.equal(fakeCookie.status, 401);

console.log('Local Worker smoke passed: health, unauthenticated resource boundaries and CORS.');
