import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AdminApp from './AdminApp';
import { initStore } from '../lib/store';
import '../index.css';

// Refuse to run inside another site's frame (click-jacking protection).
if (window.top !== window.self) {
  document.body.textContent = 'افتح في السكة من الرابط الأصلي.';
  throw new Error('framed');
}

initStore('admin').then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AdminApp />
    </StrictMode>,
  );
});
