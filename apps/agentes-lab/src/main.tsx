import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Sala } from './Sala';

const raiz = document.getElementById('raiz');
if (raiz) {
  createRoot(raiz).render(
    <StrictMode>
      <Sala />
    </StrictMode>,
  );
}
