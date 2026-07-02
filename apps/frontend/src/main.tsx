import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/index';
import { useThemeStore } from './store/index';
import { useAuthStore } from './store/index';
import './i18n/i18n';
import './index.css';

// Hydrate persisted stores before rendering
useThemeStore.getState().hydrate();
useAuthStore.getState().hydrate();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
