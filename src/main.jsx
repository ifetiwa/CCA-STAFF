import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles/index.css'
import './styles/layout.css'
import './styles/guide.css'
import './styles/mobile.css'
import App from './App.jsx'
import { wakeBackend } from './utils/api'

// Fire a wake-up ping at the Render backend the moment the SPA loads, so
// the cold-start clock starts ticking while the user is still reading the
// login page — by the time they click "Sign in", gunicorn is usually ready.
wakeBackend()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
