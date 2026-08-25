import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './i18n'; // Initialize i18next before rendering the app
import App from './App.tsx';
import './index.css';
import { initGlobalErrorListeners } from './services/errorLoggingService';

// Initialize global runtime and promise rejection interceptors
initGlobalErrorListeners();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
