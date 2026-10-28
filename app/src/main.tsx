import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Offline + installable: only in production builds, so dev reloads are never served stale from the cache.
// A new version takes over in the background; App shows "Update ready" when the page is still running the old one.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) dispatchEvent(new Event('czechlab-update')) })
  navigator.serviceWorker.register('./sw.js').then((r) => setInterval(() => r.update(), 60 * 60e3))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
