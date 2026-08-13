import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted fonts (no runtime Google Fonts request; works offline / in embed mode).
// Imported before index.css so the @font-face rules exist when the tokens reference
// them. Vendored latin/latin-ext faces rather than the @fontsource-variable package
// entry points, which ship all six subsets — see the header of fonts.css.
import './fonts.css'
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
