import { useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, MenuItem, Paper, Select, Stack, TextField, Typography,
} from '@mui/material';
import { Link, useParams } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authClient } from '../lib/auth-client';
import { environmentsApi } from '../lib/environments-api';
import { secretsApi, type SecretMetadata } from '../lib/secrets-api';
import { SignInPage } from './SignInPage';

const keyIsValid = (key: string) => /^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(key);
const valueIsValid = (value: string) => new TextEncoder().encode(value).byteLength <= 16384;

function SecretRow({
  secret, projectId, environmentId, onSaved, onDelete,
}: {
  secret: SecretMetadata;
  projectId: string;
  environmentId: string;
  onSaved: () => Promise<unknown>;
  onDelete: (secret: SecretMetadata) => void;
}) {
  const [key, setKey] = useState(secret.key);
  const [value, setValue] = useState('');
  const [original, setOriginal] = useState('');
  const [focused, setFocused] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const requestVersion = useRef(0);
  const focusedRef = useRef(false);
  const dirty = key !== secret.key || (loaded && value !== original);
  const canSave = dirty && keyIsValid(key) && loaded && valueIsValid(value) && !saving;
  
  // Never retain revealed plaintext after navigating to another environment.
  useEffect(() => () => { requestVersion.current += 1; }, []);

  async function reveal() {
    focusedRef.current = true;
    setFocused(true);
    if (loaded) return;
    const version = ++requestVersion.current;
    setLoading(true);
    setError('');
    try {
      const result = await secretsApi.reveal(projectId, environmentId, secret.id);
      if (focusedRef.current && requestVersion.current === version) {
        setOriginal(result.value);
        setValue(result.value);
        setLoaded(true);
      }
    } catch (err) {
      if (focusedRef.current && requestVersion.current === version) {
        setError(err instanceof Error ? err.message : 'Unable to reveal secret');
      }
    } finally {
      if (requestVersion.current === version) setLoading(false);
    }
  }

  function hide() {
    focusedRef.current = false;
    requestVersion.current += 1;
    setFocused(false);
    setLoading(false);
    // Preserve an edited draft long enough to save/cancel, but discard an
    // unchanged revealed value as soon as the input loses focus.
    if (!dirty) {
      setValue('');
      setOriginal('');
      setLoaded(false);
    }
  }

  function cancel() {
    requestVersion.current += 1;
    focusedRef.current = false;
    setFocused(false);
    setKey(secret.key);
    setValue('');
    setOriginal('');
    setLoaded(false);
    setError('');
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      await secretsApi.save(projectId, environmentId, secret.id, key.trim(), value);
      cancel();
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save secret');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box sx={{ py: 1.5, px: 2, borderBottom: 1, borderColor: 'divider' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} alignItems={{ sm: 'center' }}>
        <TextField size="small" label="Key" value={key}
          onChange={(event) => setKey(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 128, 'aria-label': `Key for ${secret.key}` } }}
          sx={{ flex: 1, minWidth: 150 }} />
        <TextField
          size="small" label="Environment value" type={focused ? 'text' : 'password'}
          value={loaded ? value : ''}
          placeholder="••••••••"
          onFocus={() => void reveal()}
          onBlur={hide}
          onChange={(event) => {
            // Ignore any in-flight reveal after the user starts typing.
            requestVersion.current += 1;
            setValue(event.target.value);
            setLoaded(true);
          }}
          slotProps={{ htmlInput: { autoComplete: 'off', spellCheck: false, 'aria-label': `Value for ${secret.key}` } }}
          sx={{ flex: 2, minWidth: 180 }}
        />
        {loading && <CircularProgress size={18} aria-label="Revealing secret" />}
        {dirty ? (
          <Stack direction="row" gap={0.5}>
            <IconButton aria-label={`Save ${secret.key}`} color="primary" disabled={!canSave}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void save()}>✓</IconButton>
            <IconButton aria-label={`Cancel changes to ${secret.key}`} disabled={saving}
              onClick={cancel}>×</IconButton>
          </Stack>
        ) : (
          <IconButton aria-label={`Delete ${secret.key}`} color="default"
            onClick={() => onDelete(secret)}>⋯</IconButton>
        )}
      </Stack>
      {error && <Alert severity="error" sx={{ mt: 1 }} onClose={() => setError('')}>{error}</Alert>}
      {loaded && !valueIsValid(value) && <Typography color="error" variant="caption">Maximum value size is 16 KiB.</Typography>}
    </Box>
  );
}

function SecretsManager({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [environmentId, setEnvironmentId] = useState('');
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [deleting, setDeleting] = useState<SecretMetadata | null>(null);
  const [error, setError] = useState('');

  const environments = useQuery({
    queryKey: ['environments', projectId],
    queryFn: () => environmentsApi.list(projectId),
  });
  const entries = environments.data?.data ?? [];
  const activeId = entries.some((e) => e.id === environmentId) ? environmentId : (entries[0]?.id ?? '');
  const listKey = ['secrets', projectId, activeId] as const;
  const secrets = useQuery({
    queryKey: listKey,
    queryFn: () => secretsApi.list(projectId, activeId),
    enabled: Boolean(activeId),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['secrets', projectId, activeId] });
  const create = useMutation({
    mutationFn: () => secretsApi.create(projectId, activeId, newKey.trim(), newValue),
    onSuccess: async () => {
      setNewKey('');
      setNewValue('');
      setAdding(false);
      setError('');
      await refresh();
    },
    onError: (err: Error) => setError(err.message),
  });
  const remove = useMutation({
    mutationFn: () => secretsApi.remove(projectId, activeId, deleting!.id),
    onSuccess: async () => {
      setDeleting(null);
      setError('');
      await refresh();
    },
    onError: (err: Error) => setError(err.message),
  });
  const closeCreate = () => {
    if (create.isPending) return;
    setAdding(false);
    setNewKey('');
    setNewValue('');
    setError('');
  };
  const validNew = keyIsValid(newKey.trim()) && valueIsValid(newValue);

  return (
    <Stack spacing={3}>
      <Box>
        <Link to="/projects/$projectId/environments" params={{ projectId }}>Back to environments</Link>
      </Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2} alignItems={{ sm: 'center' }}>
        <Typography variant="h4" component="h1">Secrets</Typography>
        <Button variant="contained" disabled={!activeId} onClick={() => { setError(''); setAdding(true); }}>Add secret</Button>
      </Stack>
      {environments.isError && <Alert severity="error">{environments.error.message}</Alert>}
      {entries.length > 0 && (
        <Stack direction="row" alignItems="center" gap={2}>
          <Typography component="label" htmlFor="secret-environment">Environment</Typography>
          <Select id="secret-environment" value={activeId} size="small"
            onChange={(event) => {
              setEnvironmentId(event.target.value);
              setDeleting(null);
              closeCreate();
              setError('');
            }} sx={{ minWidth: 200 }}>
            {entries.map((entry) => <MenuItem key={entry.id} value={entry.id}>{entry.name}</MenuItem>)}
          </Select>
        </Stack>
      )}
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        {!activeId ? (
          <Typography color="text.secondary" sx={{ p: 3 }}>Create an environment to manage secrets.</Typography>
        ) : secrets.isPending ? (
          <Box sx={{ py: 5, textAlign: 'center' }}><CircularProgress aria-label="Loading secrets" /></Box>
        ) : secrets.isError ? (
          <Alert severity="error">{secrets.error.message}</Alert>
        ) : secrets.data.data.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 3 }}>No secrets in this environment.</Typography>
        ) : secrets.data.data.map((secret) => (
          <SecretRow key={secret.id + ':' + activeId} secret={secret} projectId={projectId}
            environmentId={activeId} onSaved={refresh} onDelete={setDeleting} />
        ))}
      </Paper>
      <Dialog open={adding} onClose={closeCreate} fullWidth maxWidth="sm">
        <DialogTitle>Add secret</DialogTitle>
        <Box component="form" autoComplete="off" onSubmit={(event) => { event.preventDefault(); if (validNew && !create.isPending) create.mutate(); }}>
          <DialogContent>
            <Stack spacing={2}>
              <TextField label="Key" autoFocus fullWidth value={newKey}
                onChange={(event) => setNewKey(event.target.value)}
                slotProps={{ htmlInput: { maxLength: 128, spellCheck: false } }}
                helperText="Letters, numbers and underscores; cannot begin with a number." />
              <TextField label="Value" type="password" fullWidth value={newValue}
                onChange={(event) => setNewValue(event.target.value)}
                slotProps={{ htmlInput: { autoComplete: 'new-password', spellCheck: false } }}
                helperText="Value is encrypted on the server. Maximum 16 KiB." />
              {!valueIsValid(newValue) && <Alert severity="error">Value exceeds 16 KiB.</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeCreate} disabled={create.isPending}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={!validNew || create.isPending}>Create</Button>
          </DialogActions>
        </Box>
      </Dialog>
      <Dialog open={deleting !== null} onClose={remove.isPending ? undefined : () => setDeleting(null)}>
        <DialogTitle>Delete secret?</DialogTitle>
        <DialogContent>
          <Typography>Delete {deleting?.key} from this environment? This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)} disabled={remove.isPending}>Cancel</Button>
          <Button color="error" variant="contained" disabled={remove.isPending}
            onClick={() => remove.mutate()}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

export function SecretsPage() {
  const { projectId } = useParams({ from: '/projects/$projectId/secrets' });
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return <CircularProgress aria-label="Loading session" />;
  if (!session) return <SignInPage />;
  return <SecretsManager projectId={projectId} />;
}
