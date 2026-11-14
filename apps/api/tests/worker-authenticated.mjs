import assert from 'node:assert/strict';

const base = 'http://127.0.0.1:8787';
async function request(path, { method = 'GET', cookie, json } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(json === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: json === undefined ? undefined : JSON.stringify(json),
    redirect: 'manual',
    signal: AbortSignal.timeout(8000),
  });
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}
  return { response, data, text };
}

function status(result, expected, message) {
  assert.equal(result.response.status, expected,
    `${message}: expected ${expected}, got ${result.response.status}: ${result.text.slice(0, 400)}`);
}

async function fixture(email) {
  const result = await request('/__test__/signup', { method: 'POST', json: { email } });
  status(result, 200, 'test signup');
  const raw = result.response.headers.get('set-cookie');
  assert.ok(raw, 'test signup returned no session cookie');
  return raw.split(';', 1)[0];
}

const ownerCookie = await fixture('owner@example.test');
const outsiderCookie = await fixture('outsider@example.test');

status(await request('/api/projects', { cookie: outsiderCookie }), 403, 'other user forbidden');
status(await request('/api/projects', { cookie: 'better-auth.session_token=fake' }), 401, 'fake token forbidden');
status(await request('/api/projects'), 401, 'anonymous forbidden');
status(await request('/api/me', { cookie: ownerCookie }), 200, 'owner session accepted');

const createProject = await request('/api/projects', {
  method: 'POST', cookie: ownerCookie, json: { name: 'Integration project' },
});
status(createProject, 201, 'project create');
const projectId = createProject.data.id;

const environments = await request(`/api/projects/${projectId}/environments`, { cookie: ownerCookie });
status(environments, 200, 'environments list');
assert.equal(environments.data.data.length, 3);
const dev = environments.data.data.find(e => e.slug === 'development');
const prod = environments.data.data.find(e => e.slug === 'production');
assert.ok(dev && prod);

const prefix = (env) => `/api/projects/${projectId}/environments/${env.id}`;
const createFolder = await request(prefix(dev) + '/folders', {
  method: 'POST', cookie: ownerCookie, json: { name: 'Backend', parentId: null },
});
status(createFolder, 201, 'create folder');
const folderId = createFolder.data.id;

const create = await request(prefix(dev) + '/secrets', {
  method: 'POST', cookie: ownerCookie,
  json: { key: 'API_TOKEN', value: 'private-value-1', folderId },
});
status(create, 201, 'secret create');
const secretId = create.data.id;
assert.ok(!JSON.stringify(create.data).includes('private-value-1'));

const list = await request(prefix(dev) + `/secrets?folderId=${folderId}`, { cookie: ownerCookie });
status(list, 200, 'folder secret list');
assert.equal(list.data.data.length, 1);
assert.ok(!JSON.stringify(list.data).includes('private-value-1'));

const reveal = await request(prefix(dev) + `/secrets/${secretId}/reveal`, {
  method: 'POST', cookie: ownerCookie,
});
status(reveal, 200, 'reveal original');
assert.deepEqual(reveal.data, { value: 'private-value-1' });
assert.equal(reveal.response.headers.get('cache-control'), 'no-store');

status(await request(prefix(prod) + `/secrets/${secretId}/reveal`, {
  method: 'POST', cookie: ownerCookie,
}), 404, 'cross-environment reveal denied');

status(await request(prefix(dev) + `/secrets/${secretId}/reveal`, {
  method: 'POST', cookie: outsiderCookie,
}), 403, 'nonowner reveal denied');

const update = await request(prefix(dev) + `/secrets/${secretId}`, {
  method: 'PATCH', cookie: ownerCookie,
  json: { key: 'API_TOKEN', value: 'private-value-2' },
});
status(update, 200, 'secret update');
const changed = await request(prefix(dev) + `/secrets/${secretId}/reveal`, {
  method: 'POST', cookie: ownerCookie,
});
status(changed, 200, 'reveal update');
assert.deepEqual(changed.data, { value: 'private-value-2' });

const moved = await request(prefix(dev) + `/secrets/${secretId}/folder`, {
  method: 'PATCH', cookie: ownerCookie, json: { folderId: null },
});
status(moved, 200, 'move secret to root');
const rootList = await request(prefix(dev) + '/secrets', { cookie: ownerCookie });
status(rootList, 200, 'root list');
assert.ok(rootList.data.data.some(row => row.id === secretId));

const deletion = await request(prefix(dev) + `/secrets/${secretId}`, {
  method: 'DELETE', cookie: ownerCookie,
});
status(deletion, 204, 'secret delete');
status(await request(prefix(dev) + `/secrets/${secretId}/reveal`, {
  method: 'POST', cookie: ownerCookie,
}), 404, 'deleted secret cannot reveal');

const audit = await request(`/api/projects/${projectId}/audit`, { cookie: ownerCookie });
status(audit, 200, 'owner audit feed');
const actions = audit.data.data.map(event => event.action);
for (const action of ['secret.created', 'secret.updated', 'secret.moved', 'secret.deleted', 'secret.reveal_requested']) {
  assert.ok(actions.includes(action), `missing audit action ${action}`);
}
assert.ok(!JSON.stringify(audit.data).includes('private-value'));

console.log('Authenticated local Worker integration passed: session, scopes, encrypted CRUD, reveal, audit.');
