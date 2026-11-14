import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFolderName, validateFolderTarget } from '../src/folders/validation.ts';

test('validates folder names', () => {
  assert.equal(validateFolderName({ name: '  My secrets  ' }), 'My secrets');
  for (const name of ['', ' ', '/', 'a\\b', 'x'.repeat(61), 'x\n', 42]) {
    assert.equal(validateFolderName({ name }), null);
  }
  assert.equal(validateFolderName({ name: 'safe', projectId: 'other' }), null);
});
test('folder move target is explicitly null or ID', () => {
  assert.equal(validateFolderTarget({ folderId: null }), null);
  assert.equal(validateFolderTarget({ folderId: 'abc' }), 'abc');
  for (const input of [null, {}, { folderId: 0 }, { folderId: '' }, { folderId: 'abc', environmentId: 'other' }]) {
    assert.equal(validateFolderTarget(input), undefined);
  }
});
