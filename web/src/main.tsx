import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/charts/styles.css';
import './global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { configureApi, SessionProvider } from '@tasknet/shared';
import { theme } from './theme';
import { router } from './router';

const TOKEN_KEY = 'tasknet_token';

configureApi({
  baseUrl: import.meta.env.VITE_API_BASE ?? 'http://localhost:8000',
  tokenStore: {
    async get() {
      try {
        return localStorage.getItem(TOKEN_KEY);
      } catch {
        return null;
      }
    },
    async set(token) {
      try {
        localStorage.setItem(TOKEN_KEY, token);
      } catch {
        /* storage unavailable: the session lasts until reload */
      }
    },
    async clear() {
      try {
        localStorage.removeItem(TOKEN_KEY);
      } catch {
        /* ignore */
      }
    },
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme}>
      <Notifications position="top-right" />
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <ModalsProvider>
            <RouterProvider router={router} />
          </ModalsProvider>
        </SessionProvider>
      </QueryClientProvider>
    </MantineProvider>
  </StrictMode>,
);
