import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme'
import App from './App.jsx'
import { installErrorReporting, recordVisit } from './lib/telemetry.js'

installErrorReporting()
recordVisit()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
