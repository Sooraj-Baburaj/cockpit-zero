import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DigestScreen } from './screens/DigestScreen.js';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DigestScreen />
  </StrictMode>,
);
