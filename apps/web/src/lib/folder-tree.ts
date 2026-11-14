import type { SecretFolder } from './folders-api';

/**
 * Build a navigable root-to-leaf chain. Returns null for stale IDs,
 * orphaned parent references or cycles, never an unbounded traversal.
 */
export function getFolderPath(
  folders: readonly Pick<SecretFolder, 'id' | 'name' | 'parentId'>[],
  selectedId: string | null,
): Pick<SecretFolder, 'id' | 'name' | 'parentId'>[] | null {
  if (selectedId === null) return [];
  const byId = new Map(folders.map(folder => [folder.id, folder]));
  const seen = new Set<string>();
  const path: Pick<SecretFolder, 'id' | 'name' | 'parentId'>[] = [];
  let cursor: string | null = selectedId;
  while (cursor !== null) {
    if (seen.has(cursor)) return null;
    seen.add(cursor);
    const entry = byId.get(cursor);
    if (!entry) return null;
    path.push(entry);
    cursor = entry.parentId;
  }
  return path.reverse();
}

/** Excludes the selected folder and all its descendants as move targets. */
export function getFolderDescendantIds(
  folders: readonly Pick<SecretFolder, 'id' | 'parentId'>[],
  folderId: string,
): Set<string> {
  const descendants = new Set<string>([folderId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const folder of folders) {
      if (folder.parentId && descendants.has(folder.parentId) && !descendants.has(folder.id)) {
        descendants.add(folder.id);
        changed = true;
      }
    }
  }
  return descendants;
}
