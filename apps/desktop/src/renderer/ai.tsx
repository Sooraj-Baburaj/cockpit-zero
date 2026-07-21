import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AiChatScreen } from './screens/AiChatScreen.js';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AiChatScreen />
  </StrictMode>,
);
