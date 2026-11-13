import { Button, Stack, Typography } from '@mui/material';
import { Link } from '@tanstack/react-router';

export function NotFoundPage() {
  return (
    <Stack spacing={2} alignItems="flex-start">
      <Typography variant="h4" component="h1">Page not found</Typography>
      <Typography color="text.secondary">The requested page does not exist.</Typography>
      <Button component={Link} to="/" variant="contained">Go home</Button>
    </Stack>
  );
}
