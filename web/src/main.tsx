import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CssBaseline } from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

import App from './App'
import './index.css'
import { AppThemeProvider } from './theme/AppThemeProvider'
import { NhostProvider } from './nhost/NhostProvider'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <NhostProvider>
          <AppThemeProvider>
            <CssBaseline />
            <App />
            <Toaster
              position="bottom-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: 'var(--color-bg-card)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-lg)',
                  fontSize: '14px',
                  fontFamily: 'var(--font-body)',
                  maxWidth: '340px',
                  padding: '12px 16px',
                },
                success: {
                  style: {
                    borderLeft: '3px solid var(--color-income)',
                  },
                },
                error: {
                  style: {
                    borderLeft: '3px solid var(--color-expense)',
                  },
                },
              }}
            />
          </AppThemeProvider>
        </NhostProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
