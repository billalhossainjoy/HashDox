import test from 'node:test';
import assert from 'node:assert/strict';
import { canMoveFolder } from '../src/folders/hierarchy.ts';

const folders = [
  { id: 'root', parentId: null },
  { id: 'child', parentId: 'root' },
  { id: 'grandchild', parentId: 'child' },
  { id: 'elsewhere', parentId: null },
];

test('can move between independent branches and to root', () => {
  assert.equal(canMoveFolder(folders, 'child', 'elsewhere'), true);
  assert.equal(canMoveFolder(folders, 'grandchild', null), true);
});
test('rejects self, descendant, absent IDs and pre-existing cycles', () => {
  assert.equal(canMoveFolder(folders, 'root', 'root'), false);
  assert.equal(canMoveFolder(folders, 'root', 'child'), false);
  assert.equal(canMoveFolder(folders, 'root', 'grandchild'), false);
  assert.equal(canMoveFolder(folders, 'missing', null), false);
  assert.equal(canMoveFolder(folders, 'child', 'missing'), false);
  const cyclic = [{ id: 'a', parentId: 'b' }, { id: 'b', parentId: 'a' }, { id: 'c', parentId: null }];
  assert.equal(canMoveFolder(cyclic, 'c', 'a'), false);
});
