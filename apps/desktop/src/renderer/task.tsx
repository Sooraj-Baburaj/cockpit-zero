import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TaskScreen } from './screens/TaskScreen.js';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TaskScreen />
  </StrictMode>,
);
