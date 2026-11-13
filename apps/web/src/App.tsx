import { Container, Stack, Typography } from '@mui/material';

export default function App() {
  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Stack spacing={2}>
        <Typography variant="h3" component="h1">HashDox</Typography>
        <Typography variant="body1" color="text.secondary">
          Frontend workspace initialized. Application features will be added in later branches.
        </Typography>
      </Stack>
    </Container>
  );
}
