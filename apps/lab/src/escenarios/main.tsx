import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Escenarios } from './Escenarios';

const raiz = document.getElementById('raiz');
if (raiz) {
  createRoot(raiz).render(
    <StrictMode>
      <Escenarios />
    </StrictMode>,
  );
}
