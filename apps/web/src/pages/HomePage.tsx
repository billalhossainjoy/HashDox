import { Stack, Typography } from '@mui/material';

export function HomePage() {
  return (
    <Stack spacing={2}>
      <Typography variant="h4" component="h1">HashDox</Typography>
      <Typography color="text.secondary">
        Frontend foundation is ready. Authentication and project management will be implemented in later branches.
      </Typography>
    </Stack>
  );
}
