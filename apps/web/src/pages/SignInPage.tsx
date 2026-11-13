import { useState } from 'react';
import { Alert, Button, Paper, Stack, Typography } from '@mui/material';
import { authClient } from '../lib/auth-client';

export function SignInPage() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    setError('');
    try {
      const { error: authError } = await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/',
      });
      if (authError) setError('Google sign-in failed. Check your account access.');
    } catch {
      setError('Cannot connect to authentication service.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Paper variant="outlined" sx={{ maxWidth: 440, mx: 'auto', p: 4 }}>
      <Stack spacing={3}>
        <Typography variant="h5" component="h1">Sign in to HashDox</Typography>
        <Typography color="text.secondary">Google sign-in for the configured owner account.</Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <Button variant="contained" disabled={busy} onClick={signIn}>
          {busy ? 'Connecting…' : 'Continue with Google'}
        </Button>
      </Stack>
    </Paper>
  );
}
