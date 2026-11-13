import { Button, CircularProgress, Stack, Typography } from '@mui/material';
import { authClient } from '../lib/auth-client';
import { SignInPage } from './SignInPage';

export function HomePage() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return <Stack alignItems="center" sx={{ pt: 8 }}><CircularProgress /></Stack>;
  if (!session) return <SignInPage />;

  return (
    <Stack spacing={2} alignItems="flex-start">
      <Typography component="h1" variant="h4">HashDox</Typography>
      <Typography color="text.secondary">Signed in as {session.user.email}</Typography>
      <Typography>Authentication foundation configured. Project management comes next.</Typography>
      <Button variant="outlined" onClick={() => void authClient.signOut()}>Sign out</Button>
    </Stack>
  );
}
