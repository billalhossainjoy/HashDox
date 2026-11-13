import type { ReactNode } from 'react';
import { AppBar, Box, Button, Container, Stack, Toolbar, Typography } from '@mui/material';
import { Link } from '@tanstack/react-router';
import { authClient } from '../lib/auth-client';

export function AppShell({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession();
  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar sx={{ gap: 3 }}>
          <Typography component={Link} to="/" variant="h6"
            sx={{ textDecoration: 'none', color: 'text.primary', fontWeight: 700 }}>
            HashDox
          </Typography>
          {session && (
            <Stack direction="row" alignItems="center" sx={{ flexGrow: 1 }}>
              <Button component={Link} to="/projects" color="inherit">Projects</Button>
            </Stack>
          )}
        </Toolbar>
      </AppBar>
      <Container component="main" maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        {children}
      </Container>
    </Box>
  );
}
