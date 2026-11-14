import { useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, IconButton, List, ListItem, ListItemText,
  Menu, MenuItem, Paper, Stack, TextField, Typography,
} from '@mui/material';
import { Link, useParams } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authClient } from '../lib/auth-client';
import { environmentsApi, type ProjectEnvironment } from '../lib/environments-api';
import { SignInPage } from './SignInPage';

function EnvironmentManager({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ['environments', projectId] as const;
  const [editing, setEditing] = useState<ProjectEnvironment | 'new' | null>(null);
  const [name, setName] = useState('');
  const [deleting, setDeleting] = useState<ProjectEnvironment | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuItem, setMenuItem] = useState<ProjectEnvironment | null>(null);
  const [error, setError] = useState('');

  const query = useQuery({ queryKey, queryFn: () => environmentsApi.list(projectId) });
  const save = useMutation({
    mutationFn: () => editing === 'new'
      ? environmentsApi.create(projectId, name.trim())
      : environmentsApi.rename(projectId, (editing as ProjectEnvironment).id, name.trim()),
    onSuccess: async () => {
      setEditing(null);
      setError('');
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: Error) => setError(err.message),
  });
  const remove = useMutation({
    mutationFn: () => environmentsApi.remove(projectId, deleting!.id),
    onSuccess: async () => {
      setDeleting(null);
      setError('');
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: Error) => setError(err.message),
  });

  const openEditor = (entry: ProjectEnvironment | 'new') => {
    setError('');
    setEditing(entry);
    setName(entry === 'new' ? '' : entry.name);
  };
  const valid = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name.trim().toLowerCase().replace(/\s+/g, '-'))
    && name.trim().length <= 60;

  return (
    <Stack spacing={3}>
      <Box>
        <Button component={Link} to="/projects" size="small">Back to projects</Button>
      </Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2} alignItems={{ sm: 'center' }}>
        <Typography variant="h4" component="h1">Environments</Typography>
        <Stack direction="row" gap={1}>
          <Link to="/projects/$projectId/secrets" params={{ projectId }}>
            <Button variant="outlined">Open secrets</Button>
          </Link>
          <Button variant="contained" onClick={() => openEditor('new')}>Add environment</Button>
        </Stack>
      </Stack>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      <Paper variant="outlined">
        {query.isPending ? (
          <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress aria-label="Loading environments" /></Box>
        ) : query.isError ? (
          <Alert severity="error">{query.error.message}</Alert>
        ) : query.data.data.length === 0 ? (
          <Typography sx={{ p: 3 }} color="text.secondary">No environments in this project.</Typography>
        ) : (
          <List disablePadding>
            {query.data.data.map((entry, i) => (
              <Box key={entry.id}>
                {i > 0 && <Divider />}
                <ListItem secondaryAction={
                  <IconButton aria-label={`Actions for ${entry.name}`} onClick={(event) => {
                    setMenuAnchor(event.currentTarget); setMenuItem(entry);
                  }}>⋯</IconButton>
                }>
                  <ListItemText primary={entry.name} secondary={`Slug: ${entry.slug}`} />
                </ListItem>
              </Box>
            ))}
          </List>
        )}
      </Paper>
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem onClick={() => { setMenuAnchor(null); if (menuItem) openEditor(menuItem); }}>Rename</MenuItem>
        <MenuItem onClick={() => { setMenuAnchor(null); if (menuItem) setDeleting(menuItem); }}>Delete</MenuItem>
      </Menu>
      <Dialog open={editing !== null} onClose={save.isPending ? undefined : () => setEditing(null)} fullWidth maxWidth="xs">
        <DialogTitle>{editing === 'new' ? 'Add environment' : 'Rename environment'}</DialogTitle>
        <Box component="form" onSubmit={(e) => { e.preventDefault(); if (valid && !save.isPending) save.mutate(); }}>
          <DialogContent>
            <TextField autoFocus fullWidth label="Environment name" value={name}
              onChange={(e) => setName(e.target.value)} slotProps={{ htmlInput: { maxLength: 60 } }}
              helperText="Letters, numbers, spaces or hyphens. The unique slug is fixed after creation." />
          </DialogContent>
          <DialogActions>
            <Button disabled={save.isPending} onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={!valid || save.isPending}>Save</Button>
          </DialogActions>
        </Box>
      </Dialog>
      <Dialog open={deleting !== null} onClose={remove.isPending ? undefined : () => setDeleting(null)}>
        <DialogTitle>Delete environment?</DialogTitle>
        <DialogContent><Typography>Delete {deleting?.name}? This action cannot be undone.</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)} disabled={remove.isPending}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => remove.mutate()} disabled={remove.isPending}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

export function EnvironmentsPage() {
  const { projectId } = useParams({ from: '/projects/$projectId/environments' });
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return <CircularProgress aria-label="Loading session" />;
  if (!session) return <SignInPage />;
  return <EnvironmentManager projectId={projectId} />;
}
