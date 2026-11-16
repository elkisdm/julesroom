import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Caminata } from './Caminata';

const raiz = document.getElementById('raiz');
if (raiz) {
  createRoot(raiz).render(
    <StrictMode>
      <Caminata />
    </StrictMode>,
  );
}
