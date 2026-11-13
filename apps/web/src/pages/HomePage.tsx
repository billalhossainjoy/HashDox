import { Button, CircularProgress, Stack, Typography } from '@mui/material';
import { Link } from '@tanstack/react-router';
import { authClient } from '../lib/auth-client';
import { SignInPage } from './SignInPage';

export function HomePage() {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return <Stack alignItems="center" sx={{ pt: 8 }}><CircularProgress aria-label="Loading session" /></Stack>;
  if (!session) return <SignInPage />;

  return (
    <Stack spacing={2} alignItems="flex-start">
      <Typography variant="h4" component="h1">HashDox</Typography>
      <Typography color="text.secondary">Signed in as {session.user.email}</Typography>
      <Button component={Link} to="/projects" variant="contained">Open projects</Button>
      <Button variant="outlined" onClick={() => void authClient.signOut()}>Sign out</Button>
    </Stack>
  );
}
