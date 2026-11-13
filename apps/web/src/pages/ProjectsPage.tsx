import { useState, type MouseEvent } from 'react';
import {
  Alert, Box, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, Menu, MenuItem, Paper, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { projectsApi, type Project } from '../lib/projects-api';
import { authClient } from '../lib/auth-client';
import { SignInPage } from './SignInPage';

type EditorState = { mode: 'create' } | { mode: 'edit'; project: Project };
type DeleteState = { projects: Project[] };

function ProjectManager() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<DeleteState | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuProject, setMenuProject] = useState<Project | null>(null);
  const [error, setError] = useState('');

  const projects = useQuery({
    queryKey: ['projects', page],
    queryFn: () => projectsApi.list(page + 1),
  });

  const save = useMutation({
    mutationFn: () => editor?.mode === 'edit'
      ? projectsApi.update(editor.project.id, name.trim())
      : projectsApi.create(name.trim()),
    onSuccess: async () => {
      setEditor(null);
      setError('');
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err: Error) => setError(err.message),
  });
  const remove = useMutation({
    mutationFn: async () => {
      if (!deleting) return;
      // Fail visibly if any request fails; list is refreshed afterwards.
      await Promise.all(deleting.projects.map((p) => projectsApi.remove(p.id)));
    },
    onSuccess: async () => {
      setDeleting(null);
      setSelected([]);
      setError('');
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: async (err: Error) => {
      setError(err.message);
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const rows = projects.data?.data ?? [];
  const allSelected = rows.length > 0 && rows.every((p) => selected.includes(p.id));
  const selectedRows = rows.filter((p) => selected.includes(p.id));
  const openEditor = (state: EditorState) => {
    setError('');
    setEditor(state);
    setName(state.mode === 'edit' ? state.project.name : '');
  };
  const openActions = (event: MouseEvent<HTMLElement>, project: Project) => {
    setMenuAnchor(event.currentTarget);
    setMenuProject(project);
  };
  const closeMenu = () => setMenuAnchor(null);
  const editingValid = name.trim().length >= 1 && name.trim().length <= 100;
  const displayDate = (value: string | number) => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
  };

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={2}>
        <Typography variant="h4" component="h1">Projects</Typography>
        <Button variant="contained" onClick={() => openEditor({ mode: 'create' })}>New project</Button>
      </Stack>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {selectedRows.length > 0 && (
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="body2">{selectedRows.length} selected on this page</Typography>
          <Button color="error" onClick={() => setDeleting({ projects: selectedRows })}>
            Delete selected
          </Button>
        </Stack>
      )}
      <Paper variant="outlined">
        <TableContainer>
          <Table aria-label="Projects">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox aria-label="Select all projects on this page" checked={allSelected}
                    onChange={(e) => setSelected(e.target.checked ? rows.map((p) => p.id) : [])} />
                </TableCell>
                <TableCell>Project</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {projects.isPending ? (
                <TableRow><TableCell colSpan={4} align="center"><CircularProgress size={24} aria-label="Loading projects" /></TableCell></TableRow>
              ) : projects.isError ? (
                <TableRow><TableCell colSpan={4}><Alert severity="error">{projects.error.message}</Alert></TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={4} align="center">No projects found.</TableCell></TableRow>
              ) : rows.map((project) => (
                <TableRow key={project.id} hover selected={selected.includes(project.id)}>
                  <TableCell padding="checkbox">
                    <Checkbox aria-label={`Select ${project.name}`} checked={selected.includes(project.id)}
                      onChange={(e) => setSelected((current) => e.target.checked
                        ? [...current, project.id] : current.filter((id) => id !== project.id))} />
                  </TableCell>
                  <TableCell>
                    <Button component={Link} to="/projects/$projectId/environments"
                      params={{ projectId: project.id }} variant="text" sx={{ textTransform: 'none', fontWeight: 600 }}>
                      {project.name}
                    </Button>
                  </TableCell>
                  <TableCell>{displayDate(project.createdAt)}</TableCell>
                  <TableCell align="right">
                    <IconButton aria-label={`Actions for ${project.name}`} onClick={(e) => openActions(e, project)}>
                      ⋯
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={projects.data?.total ?? 0} page={page}
          rowsPerPage={20} rowsPerPageOptions={[20]}
          onPageChange={(_, nextPage) => { setPage(nextPage); setSelected([]); }}
        />
      </Paper>
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem onClick={() => { closeMenu(); if (menuProject) openEditor({ mode: 'edit', project: menuProject }); }}>Rename</MenuItem>
        <MenuItem onClick={() => { closeMenu(); if (menuProject) setDeleting({ projects: [menuProject] }); }}>Delete</MenuItem>
      </Menu>
      <Dialog open={editor !== null} onClose={save.isPending ? undefined : () => setEditor(null)} fullWidth maxWidth="xs">
        <DialogTitle>{editor?.mode === 'edit' ? 'Rename project' : 'Create project'}</DialogTitle>
        <Box component="form" onSubmit={(e) => { e.preventDefault(); if (editingValid && !save.isPending) save.mutate(); }}>
          <DialogContent>
            <TextField autoFocus fullWidth label="Project name" value={name} inputProps={{ maxLength: 100 }}
              onChange={(e) => setName(e.target.value)} error={name.length > 0 && !editingValid}
              helperText="1–100 characters" />
          </DialogContent>
          <DialogActions>
            <Button disabled={save.isPending} onClick={() => setEditor(null)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={!editingValid || save.isPending}>
              {editor?.mode === 'edit' ? 'Save' : 'Create'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      <Dialog open={deleting !== null} onClose={remove.isPending ? undefined : () => setDeleting(null)}>
        <DialogTitle>Delete {deleting?.projects.length === 1 ? 'project' : 'projects'}?</DialogTitle>
        <DialogContent>
          <Typography>This action cannot be undone. {deleting?.projects.length ?? 0} project(s) will be deleted.</Typography>
        </DialogContent>
        <DialogActions>
          <Button disabled={remove.isPending} onClick={() => setDeleting(null)}>Cancel</Button>
          <Button color="error" variant="contained" disabled={remove.isPending} onClick={() => remove.mutate()}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

export function ProjectsPage() {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return <Stack alignItems="center" sx={{ mt: 8 }}><CircularProgress aria-label="Loading session" /></Stack>;
  if (!session) return <SignInPage />;
  return <ProjectManager />;
}
