import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import FitPlan from './fitplan.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FitPlan />
  </StrictMode>,
)
