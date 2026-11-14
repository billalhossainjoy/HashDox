import { Box, Breadcrumbs, Button, CircularProgress, Stack, Typography } from '@mui/material';
import type { SecretFolder } from '../lib/folders-api';
import { getFolderPath } from '../lib/folder-tree';

export function FolderNavigator({
  folders, selectedId, onSelect, isLoading,
}: {
  folders: readonly SecretFolder[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  isLoading: boolean;
}) {
  const path = getFolderPath(folders, selectedId);
  const activeId = path?.at(-1)?.id ?? null;
  const children = folders.filter(folder => folder.parentId === activeId);

  return (
    <Stack gap={2}>
      <Breadcrumbs aria-label="Folder breadcrumb navigation" separator="/">
        <Button size="small" onClick={() => onSelect(null)}
          aria-current={activeId === null ? 'location' : undefined}
          variant={activeId === null ? 'contained' : 'text'}>Root</Button>
        {path?.map((folder, index) => (
          <Button key={folder.id} size="small" onClick={() => onSelect(folder.id)}
            aria-current={index === path.length - 1 ? 'location' : undefined}
            variant={index === path.length - 1 ? 'contained' : 'text'}
            sx={{ textTransform: 'none' }}>
            {folder.name}
          </Button>
        ))}
      </Breadcrumbs>
      {path === null && !isLoading && (
        <Typography color="error" role="alert" variant="body2">
          The selected folder has an invalid or missing parent. Return to Root.
        </Typography>
      )}
      {isLoading ? <CircularProgress size={20} aria-label="Loading folders" /> : (
        <Box>
          {children.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No subfolders here.</Typography>
          ) : (
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {children.map(folder => (
                <Button key={folder.id} size="small" variant="outlined"
                  onClick={() => onSelect(folder.id)}>
                  📁 {folder.name}
                </Button>
              ))}
            </Stack>
          )}
        </Box>
      )}
    </Stack>
  );
}
