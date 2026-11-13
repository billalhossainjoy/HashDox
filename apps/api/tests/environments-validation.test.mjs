import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ENVIRONMENTS, validateEnvironmentName, environmentSlug } from '../src/environments/validation.ts';

test('new projects have three distinct default environment slugs', () => {
  assert.deepEqual(DEFAULT_ENVIRONMENTS.map((env) => env.slug), ['development', 'staging', 'production']);
});
test('validates names and rejects extra fields', () => {
  assert.equal(validateEnvironmentName({ name: '  Preview  ' }), 'Preview');
  for (const input of [null, [], { name: '' }, { name: 42 }, { name: 'x'.repeat(61) }, { name: 'Dev', projectId: 'other' }]) {
    assert.equal(validateEnvironmentName(input), null);
  }
});
test('requires safe stable slugs', () => {
  assert.equal(environmentSlug('QA Preview'), 'qa-preview');
  for (const name of ['foo/bar', 'a_b', '⚠️', 'a--b', 'a'.repeat(61)]) {
    assert.equal(environmentSlug(name), null);
  }
});
