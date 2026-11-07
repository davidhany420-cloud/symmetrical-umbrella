import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AdminApp from './AdminApp';
import { initStore } from '../lib/store';
import '../index.css';

initStore('admin').then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AdminApp />
    </StrictMode>,
  );
});
