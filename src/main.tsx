import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initStore } from './lib/store';
import './index.css';

// Refuse to run inside another site's frame (click-jacking protection).
if (window.top !== window.self) {
  document.body.textContent = 'افتح في السكة من الرابط الأصلي.';
  throw new Error('framed');
}

initStore('app').then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
