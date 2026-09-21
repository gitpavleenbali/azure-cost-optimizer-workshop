import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './workshop.css'
import App from './Workshop.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
