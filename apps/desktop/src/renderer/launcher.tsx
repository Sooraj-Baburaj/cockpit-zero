import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LauncherBar } from './screens/LauncherBar.js';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LauncherBar />
  </StrictMode>,
);
