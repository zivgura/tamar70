import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme'
import App from './App.jsx'
import { captureFamilyCode } from './lib/familyCode.js'
import { installErrorReporting, recordVisit } from './lib/telemetry.js'

// Keep the family code from the link (?k=...) on this device, then drop it from the URL.
captureFamilyCode()
installErrorReporting()
recordVisit()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
