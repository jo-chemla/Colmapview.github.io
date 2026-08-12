import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted fonts (no runtime Google Fonts request; works offline / in embed mode).
// Imported before index.css so the @font-face rules exist when the tokens reference them.
import '@fontsource-variable/ibm-plex-sans'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
import App from './App.tsx'
import { registerAllCaches } from './cache'

// Register all caches for centralized management
registerAllCaches();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
