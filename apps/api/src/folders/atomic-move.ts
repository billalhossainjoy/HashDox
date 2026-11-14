/**
 * One SQLite UPDATE statement performs the full ancestry check and reparent.
 * D1 serializes this write; no stale SELECT -> UPDATE gap allows two writers
 * to create opposing parent relationships.
 *
 * UNION (rather than UNION ALL) terminates if legacy data already has a cycle.
 * The target's entire ancestry must belong to the same project/environment.
 */
export async function reparentFolderAtomically(
  db: D1Database,
  projectId: string,
  environmentId: string,
  folderId: string,
  parentId: string | null,
): Promise<{ id: string; parentId: string | null; parentKey: string; updatedAt: number } | null> {
  const result = await db.prepare(`
    WITH RECURSIVE ancestors(id, parent_id) AS (
      SELECT id, parent_id FROM secret_folders
      WHERE id = ?1 AND project_id = ?2 AND environment_id = ?3
      UNION
      SELECT f.id, f.parent_id FROM secret_folders AS f
      JOIN ancestors AS a ON f.id = a.parent_id
      WHERE f.project_id = ?2 AND f.environment_id = ?3
    )
    UPDATE secret_folders
    SET parent_id = ?1,
        parent_key = COALESCE(?1, ''),
        updated_at = ?4
    WHERE id = ?5 AND project_id = ?2 AND environment_id = ?3
      AND (?1 IS NULL OR EXISTS (
        SELECT 1 FROM secret_folders AS target
        WHERE target.id = ?1 AND target.project_id = ?2 AND target.environment_id = ?3
      ))
      AND NOT EXISTS (SELECT 1 FROM ancestors WHERE id = ?5)
    RETURNING id, parent_id AS parentId, parent_key AS parentKey, updated_at AS updatedAt
  `).bind(parentId, projectId, environmentId, Date.now(), folderId)
    .first<{ id: string; parentId: string | null; parentKey: string; updatedAt: number }>();
  return result ?? null;
}
