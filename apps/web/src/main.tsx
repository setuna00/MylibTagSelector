import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import './index.css'
import App from './App.tsx'
import { theme } from './theme'
import { ErrorBoundary } from './shared/components'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <MantineProvider theme={theme}>
        <Notifications />
        <App />
      </MantineProvider>
    </ErrorBoundary>
  </StrictMode>,
)
