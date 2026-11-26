import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Captura global del evento de instalación PWA para Android / Chrome / Edge
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    __deferredPwaPrompt?: BeforeInstallPromptEvent | null;
  }
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__deferredPwaPrompt = e as BeforeInstallPromptEvent;
  window.dispatchEvent(new Event('valora-pwa-ready'));
});

window.addEventListener('appinstalled', () => {
  window.__deferredPwaPrompt = null;
  window.dispatchEvent(new Event('valora-pwa-installed'));
});

if ('serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        reg.update().catch(() => {});
      })
      .catch(() => {
        // ignore SW registration warning in restricted frames
      });
  });
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
