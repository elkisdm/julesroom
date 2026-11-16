import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Movimiento } from './Movimiento';

const raiz = document.getElementById('raiz');
if (raiz) {
  createRoot(raiz).render(
    <StrictMode>
      <Movimiento />
    </StrictMode>,
  );
}
