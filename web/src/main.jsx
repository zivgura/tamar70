import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme'
import App from './App.jsx'
import { captureFamilyCode } from './lib/familyCode.js'

// Keep the family code from the link (?k=...) on this device, then drop it from the URL.
captureFamilyCode()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
