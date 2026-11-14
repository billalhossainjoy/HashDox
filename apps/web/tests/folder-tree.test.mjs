import test from 'node:test';
import assert from 'node:assert/strict';
import { getFolderPath, getFolderDescendantIds } from '../src/lib/folder-tree.ts';

const folders = [
  { id: 'a', name: 'Parent', parentId: null },
  { id: 'b', name: 'Child', parentId: 'a' },
  { id: 'c', name: 'Grandchild', parentId: 'b' },
  { id: 'd', name: 'Other', parentId: null },
];

test('returns root-to-leaf breadcrumbs at arbitrary depth', () => {
  assert.deepEqual(getFolderPath(folders, 'c')?.map(folder => folder.name),
    ['Parent', 'Child', 'Grandchild']);
  assert.deepEqual(getFolderPath(folders, null), []);
});
test('rejects missing IDs, orphaned parents and cyclic references', () => {
  assert.equal(getFolderPath(folders, 'missing'), null);
  assert.equal(getFolderPath([{ id: 'x', name: 'X', parentId: 'missing' }], 'x'), null);
  assert.equal(getFolderPath([{ id: 'x', name: 'X', parentId: 'y' }, { id: 'y', name: 'Y', parentId: 'x' }], 'x'), null);
});
test('excludes all descendants, but not independent branches', () => {
  assert.deepEqual([...getFolderDescendantIds(folders, 'a')].sort(), ['a', 'b', 'c']);
  assert.deepEqual([...getFolderDescendantIds(folders, 'd')], ['d']);
});
