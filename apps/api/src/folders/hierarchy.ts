/** Pure, scoped tree validation. The caller must supply folders from one environment. */
export type FolderNode = { id: string; parentId: string | null };

export function canMoveFolder(
  folders: readonly FolderNode[], folderId: string, targetId: string | null,
): boolean {
  if (!folderId || !folders.some(folder => folder.id === folderId)) return false;
  if (targetId === null) return true;
  const parents = new Map(folders.map(folder => [folder.id, folder.parentId]));
  if (!parents.has(targetId)) return false;
  const visited = new Set<string>();
  let candidate: string | null = targetId;
  while (candidate !== null) {
    if (candidate === folderId || visited.has(candidate)) return false;
    visited.add(candidate);
    candidate = parents.get(candidate) ?? null;
  }
  return true;
}
