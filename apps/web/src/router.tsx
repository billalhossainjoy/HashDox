import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';
import { AppShell } from './components/AppShell';
import { HomePage } from './pages/HomePage';
import { ProjectsPage } from './pages/ProjectsPage';
import { EnvironmentsPage } from './pages/EnvironmentsPage';
import { NotFoundPage } from './pages/NotFoundPage';

const rootRoute = createRootRoute({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
  notFoundComponent: NotFoundPage,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
});

const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects',
  component: ProjectsPage,
});

const environmentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/$projectId/environments',
  component: EnvironmentsPage,
});

const routeTree = rootRoute.addChildren([indexRoute, projectsRoute, environmentRoute]);
export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
