import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './workshop.css';
import './pages.css';
import PublicGuide from './PublicGuide.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PublicGuide />
  </StrictMode>,
);